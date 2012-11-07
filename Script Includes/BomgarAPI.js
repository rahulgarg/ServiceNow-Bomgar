var BomgarAPI = Class.create();
BomgarAPI.prototype = {
   
   initialize: function( appliance ) {
      this.log = new GSLog('tu.bomgar.loglevel.api','Bomgar API');
      
      // Get default appliance, or use 'teamultra.bomgar.com'
      if ( !appliance ) {
         appliance = gs.getProperty( 'tu.bomgar.hostname', 'teamultra.bomgar.com' );
      }
      
      // Find the appliance with the matching Hostname, IP or Appliance GUID
      var app = new GlideRecord('u_tu_bg_appliance');
      var qc = app.addQuery('u_hostname', appliance);
      qc.addOrCondition('u_public_ip', appliance);
      qc.addOrCondition('u_appliance_id', appliance);
      app.query();
      if ( !app.next() ) {
         throw {
            'name': 'Invalid Bomgar Appliance',
            'message': 'Failed to find Bomgar appliance [' + appliance + ']'
         };
      }
      
      this.grAppliance = app;
      this.appliance_id = app.sys_id.toString();
      this.bgConn = new BomgarConnection(app);
      this.sessionActors = {};   // Object used to cache Actor sys_ids
      
   },
   
   //----------------------------------------------------------------------------
   // The following functions return information about the state of this object.
   //----------------------------------------------------------------------------
   //
   //-------------------------------------------------------
   getSessionName: function() {
   //-------------------------------------------------------
      if (this.grSession) {
         return this.grSession.u_display_name.toString();
      } else {
         return null;
      }
   },
   
   //-------------------------------------------------------
   getErrorMessage: function() {
   //-------------------------------------------------------
      return this.errorMessage;
   },
   
   //-------------------------------------------------------
   reloadSessions: function() {
   //-------------------------------------------------------
      
      var i, msg = "getSessions";
      var sl = this.getSessionList();
      var ssl = sl.session_summary;
      var lsid, ss;
      msg += "\nSession count: " + ssl.length;
      
      // Get all of the sessions
      for ( i=0; i < ssl.length; i++ ) {
         lsid = ssl[i]["@lsid"];
         msg += "\nSession " + i + ": [" + lsid + "]";
         ss = this.retrieveSession( lsid );
         if (ss) {
            this.saveSession(ss);
         } else {
            msg += " - Failed to retrieve session data";
         }
      }
      
      this.log.logInfo(msg);
      
   },
   
   //-------------------------------------------------------
   getGlideDateTime: function(item) {
   //-------------------------------------------------------
      
      var ts = "";
      
      // Handle elements with a timestamp/ts attribute
      if ( typeof item == 'object' && item["@timestamp"] ) {
         ts = item["@timestamp"];
      } else if ( typeof item == 'object' && item["@ts"] ) {
         ts = item["@ts"];
      } else {
         // Otherwise treat as a string
         ts = item;
      }
      
      var secs = parseInt(ts);
      var gdt = new GlideDateTime();
      if ( secs > 0 ) {
         gdt.setNumericValue( secs * 1000 );
         return gdt;
      } else {
         return null;
      }
      
   },
   
   //----------------------------------------------------------------------------
   // The following ( mostly retrieveXXX ) functions retrieve information from the
   // Bomgar appliance. Data is returned as a JavaScript object which reflects the
   // structure of the XML document returned by the Bomgar API.
   //----------------------------------------------------------------------------
   //
   //-------------------------------------------------------
   generateSessionKey: function(task_no) {
   //-------------------------------------------------------
      var pa = [];  // Param array
      pa.push( [ "action", "generate_session_key" ] );
      pa.push( [ "type", "support" ] );
      pa.push( [ "queue_id", "general" ] );
      pa.push( [ "external_key", task_no ] );

      var resp = this.bgConn.sendCommand(pa);
      return this.checkResponse( resp, 'session_key' );
   },

   //-------------------------------------------------------
   retrieveApiInfo: function() {
   //-------------------------------------------------------
      var pa = [];  // Param array
      pa.push( [ "action", "get_api_info" ] );

      var resp = this.bgConn.sendCommand(pa);
      return this.checkResponse( resp, 'api_information' );
   },
   
   //-------------------------------------------------------
   retrieveLoggedInReps: function() {
   //-------------------------------------------------------
      var pa = [];  // Param array
      pa.push( [ "action", "get_logged_in_reps" ] );

      var resp = this.bgConn.sendCommand(pa);
      return this.checkResponse( resp, 'logged_in_reps', 'rep' );
   },
   
   //-------------------------------------------------------
   retrieveSupportTeams: function( showmembers ) {
   //-------------------------------------------------------
      var pa = [];  // Param array
      pa.push( [ "action", "get_support_teams" ] );
      if (showmembers) {
         pa.push( [ "showmembers", "1" ] );
      }

      var resp = this.bgConn.sendCommand(pa);
      return this.checkResponse( resp, 'support_teams', 'support_team' );
   },
   
   //-------------------------------------------------------
   retrieveSessionList: function() {
   //-------------------------------------------------------
      var pa = [];  // Param array
      pa.push( [ "generate_report", "SupportSessionListing" ] );

      var resp = this.bgConn.runReport(pa);
      return this.checkResponse( resp, 'session_summary_list', 'session_summary' );
   },
   
   //-------------------------------------------------------
   retrieveSessionSummary: function() {
   //-------------------------------------------------------
      var pa = [];  // Param array
      pa.push( [ "generate_report", "SupportSessionSummary" ] );
      pa.push( [ "report_type", "rep" ] );

      var resp = this.bgConn.runReport(pa);
      return this.checkResponse( resp, 'summary_list', 'summary' );
   },
   
   //-------------------------------------------------------
   retrieveExitSurvey: function( lsid, survey_type ) {
   //-------------------------------------------------------
      
      // Get session end_time
      this.findSession(lsid);
      var ms = this.grSession.u_start_time.getGlideObject().getNumericValue(); // milli-seconds
      var et = Math.round( ms / 1000 ) - 5; // Convert to seconds and adjust down by 5 secs
      
      var pa = [];  // Param array
      if ( survey_type == 'rep' ) {
         pa.push( [ "generate_report", "SupportRepExitSurvey" ] );
      } else {
         pa.push( [ "generate_report", "SupportCustExitSurvey" ] );
      }
      pa.push( [ "start_time", et ] );
      pa.push( [ "duration", "10" ] ); // Search within 10 sec window
      pa.push( [ "report_type", "rep" ] );
      pa.push( [ "id", "all" ] );
      
      var resp = this.bgConn.runReport(pa);
      return this.checkResponse( resp, 'exit_survey_list', 'exit_survey' );
   },
   
   //-------------------------------------------------------
   retrieveSession: function( lsid ) {
   //-------------------------------------------------------
      
      var msg = "retrieveSession( " + lsid + " )";
      var pa = [];  // Param array
      pa.push( [ "generate_report", "SupportSession" ] );
      pa.push( [ "lsid", lsid ] );

      var resp = this.bgConn.runReport(pa);
      return this.checkResponse( resp, 'session_list', 'session' );
   },
   
   //-------------------------------------------------------
   checkResponse: function( resp, valid_root, valid_child ) {
   //-------------------------------------------------------

      var msg = "";
      
      // Get XML root element
      var root = this.bgConn.getResponseRootName();
      
      // Check XML root for success first
      if ( root == valid_root ) {
         if ( !valid_child ) {
            // No child element expected, return entire response
            return resp;
         } else if ( !resp ) {
            // The root element is empty
            msg = "Received empty response from Bomgar Appliance";
            msg += "\nXML root element [" + root + "] is empty";
            this.errorMessage = msg;
            return null;
         } else if ( resp[valid_child] ) {
            // Expected child element was found, return the child element
            return resp[valid_child];
         } else if ( resp.error ) {
            // The child element is an error element
            msg = "Received error response from Bomgar Appliance";
            msg += "\nError: [" + resp + "]";
            this.errorMessage = msg;
            return null;
         } else {
            msg = "Unexpected response from Bomgar Appliance";
            msg += "\nXML root: [" + root + "]";
            msg += "\nResponse: [" + resp + "]";
            this.errorMessage = msg;
            return null;
         }
      } else if ( root == 'error' ) {
         msg = "Received error response from Bomgar Appliance";
         msg += "\nError: [" + resp + "]";
         this.errorMessage = msg;
         return null;
      } else {
         msg = "Unexpected response from Bomgar Appliance";
         msg += "\nXML root: [" + root + "]";
         msg += "\nResponse: [" + resp + "]";
         msg += "\n" + this.bgConn.errorMessage;
         this.errorMessage = msg;
         return null;
      }
      
   },
   
   //----------------------------------------------------------------------------
   // The following saveXXX functions extract information from the JavaScript
   // object returned by the getXXX functions and store the data as interlinked
   // glide records.
   //
   // Whenever possible the save routines will attempt to locate an existing
   // record and update that, but will create new records when no existing
   // record is found.
   //----------------------------------------------------------------------------
   //
   //-------------------------------------------------------
   saveSession: function( session ) {
   //-------------------------------------------------------
      
      // session:  /session_list/session
      
      var i, msg = "saveSession";
      var lsid = session["@lsid"];
      if (!lsid) { return null; }
      var gr = this.findSession(lsid);
      if (!gr) { return null; }
      
      gr.u_lseq = session.lseq;
      gr.u_session_type = session.session_type;
      
      gr.u_start_time = this.getGlideDateTime( session.start_time );
      gr.u_end_time = this.getGlideDateTime( session.end_time );
      gr.u_duration = session.duration;
      
      if ( session.external_key ) {
         gr.u_external_key = session.external_key;
         gr.u_task = this.findTaskId( session.external_key );
      }
      gr.u_file_transfers = session.file_transfer_count;
      gr.u_public_site_id = session.public_site["@id"];
      gr.u_public_site_name = session.public_site["#text"];
      
      // A temporary lookup object to map gsnumber to sys_id
      this.sessionActors = {};
      
      // Save Customer (there is only ever one Customer)
      if ( session.customer_list ) {
         var cust = session.customer_list.customer;
         if ( cust ) {
            this.saveSessionCust( cust );
         }
      }
      
      // Save Session Reps
      if ( session.rep_list && session.rep_list.representative ) {
         var reps = this.ensureArray( session.rep_list.representative );
         for ( i=0; i<reps.length; i++ ) {
            this.saveSessionRep( reps[i] );
         }
      }
      
      // Compose name from primary actors
      var pri_cust_name = 'NoCustomer';
      var pri_cust = session.primary_customer;
      if ( pri_cust && pri_cust['#text'] ) {
         pri_cust_name = pri_cust['#text'];
      }
      var pri_rep_name = 'NoRep';
      var pri_rep = session.primary_rep;
      if ( pri_rep && pri_rep['#text'] ) {
         pri_rep_name = pri_rep['#text'];
      }
      gr.u_display_name = 'For ' + pri_cust_name + ' by ' + pri_rep_name;

      this.log.logDebug('saveSession - For ' + pri_cust_name + ' by ' + pri_rep_name );
      
      var s_id = gr.update();

      this.log.logDebug('saveSession - ' + s_id );
     
      // Save Session Events
      if ( session.session_details && session.session_details.event ) {
         var events = this.ensureArray( session.session_details.event );
         for ( i=0; i<events.length; i++ ) {
            this.saveSessionEvent( events[i], i );
         }
      }
      
      return 'ok';
      
   },
   
   //-------------------------------------------------------
   saveSessionCust: function( cust ) {
   //-------------------------------------------------------
      
      // cust:  /session_list/session/customer_list/customer
      
      var i;
      var session_id = this.grSession.sys_id.toString();
      var gsno = cust['@gsnumber'];
      if ( !gsno ) { return null; }
         
      var gr = new GlideRecord('u_tu_bg_session_customer');
      gr.addQuery('u_session',session_id);
      gr.addQuery('u_gsnumber',gsno);
      gr.query();
      
      if ( !gr.next() ) {
         // Record not found, so initialise object
         gr.initialise();
         gr.u_session = session_id;
         gr.u_gsnumber = gsno;
      }
      
      gr.u_actor_type = 'customer';
      gr.u_primary_actor = cust.primary_cust;
      
      // Session details
      if ( cust.info.name ) {
         gr.u_display_name = cust.info.name;
      } else {
         gr.u_display_name = cust.username;
      }
      gr.u_company = cust.info.company;
      gr.u_issue = cust.info.issue;
      
      // Environment details
      gr.u_hostname = cust.hostname;
      gr.u_username = cust.username;
      gr.u_os = cust.os;
      gr.u_private_ip = cust.private_ip;
      gr.u_public_ip = cust.public_ip;
      
      // ( Call to update will act as insert, if rec does not exist )
      var cust_id = gr.update();

      // Cache sys_id for future lookup
      var actor_key = 'gs' + gsno;
      this.log.logDebug("saveSessionCust - " + actor_key + " - " + cust_id );
     
      this.sessionActors[actor_key] = cust_id;
      return gr;
      
   },
   
   //-------------------------------------------------------
   saveSessionRep: function( rep ) {
   //-------------------------------------------------------
      
      // rep:  /session_list/session/rep_list/representative
      
      var i, session_id = this.grSession.sys_id.toString();
      var gsno = rep['@gsnumber'];
      if ( !gsno ) { return null; }
         
      var rep_id = this.findRepId(rep);
      
      var gr = new GlideRecord('u_tu_bg_session_rep');
      gr.addQuery('u_rep',rep_id);
      gr.addQuery('u_session',session_id);
      gr.addQuery('u_gsnumber',gsno);
      gr.query();
      
      if ( !gr.next() ) {
         // Record not found, so initialise object
         gr.initialise();
         gr.u_rep = rep_id;
         gr.u_session = session_id;
         gr.u_gsnumber = gsno;
      }
      
      gr.u_actor_type = 'representative';
      gr.u_primary_actor = rep.primary_rep;
      
      // Session details
      gr.u_display_name = rep.display_name;
      gr.u_seconds_involved = rep.seconds_involved;
      
      // Environment details
      gr.u_hostname = rep.hostname;
      gr.u_username = rep.username;
      gr.u_os = rep.os;
      gr.u_private_ip = rep.private_ip;
      gr.u_public_ip = rep.public_ip;
      
      // ( Call to update will act as insert, if rec does not exist )
      var session_rep_id  = gr.update();

      // Cache sys_id for future lookup
      var actor_key = 'gs' + gsno;
      this.log.logDebug("saveSessionRep - " + actor_key + " - " + session_rep_id );

      this.sessionActors[actor_key] = session_rep_id;
      return gr;
      
   },
   
   //-------------------------------------------------------
   saveExitSurvey: function( survey ) {
   //-------------------------------------------------------
      
      // survey : /exit_survey_list/exit_survey
      
      var gsno, i;
      var lsid = survey['@lsid'];
      var survey_type = survey.submitted_by['@type'];
      if ( survey_type == 'rep' ) {
         gsno = survey.primary_rep['@gsnumber'];
      } else {
         gsno = survey.primary_customer['@gsnumber'];
      }
      if ( !lsid || !gsno ) { return null; }
         
      var session_id = this.findSession(lsid).sys_id.toString();
      if (!session_id) { return null; }
         
      var gr = new GlideRecord('u_tu_bg_exit_survey');
      gr.addQuery('u_session',session_id);
      gr.addQuery('u_gsnumber',gsno);
      gr.query();
      
      if ( !gr.next() ) {
         // Record not found, so initialise object
         gr.initialise();
         gr.u_session = session_id;
         gr.u_gsnumber = gsno;
      }
      
      // Populate Survey record
      gr.u_survey_type = survey_type;
      gr.u_survey_time = this.getGlideDateTime(survey);
      if ( survey_type == 'rep' ) {
         gr.u_submitted_by = this.findActorId(survey.primary_rep);
      } else {
         gr.u_submitted_by = this.findActorId(survey.primary_customer);
      }
      
      // Ensure that we have an array
      var questions = this.ensureArray( survey.question_list.question );
      
      // Process questions and answers
      var qna = '', q, q_no, q_name, ans;
      for ( i=0; i<questions.length; i++ ) {
         q = questions[i]; q_no = q['@id'];
         qna += "Q" + q_no + ".\t(" + q.type + ")\t" + q.label +"\n";
         ans = q.answer_list.answer;

         // Ensure we have a valid string
         if (ans) {
            ans = ans.replace(/\\n/g,'');  // Strip redundant escaped newline characters
         } else {
            ans = '';
         }
         
         // Handle special types of question
         if ( q.name == 'rating' ) {
            gr.u_rating = ans;
            qna += "\t" + q.report_header + "\t" + ans + "\n";
         } else if  ( q.name == 'comments' ) {
            gr.u_comments = ans;
            qna += "\t" + q.report_header + "\t (see Comments field ) \n";
         } else {
            qna += "\t" + q.report_header + "\t" + ans + "\n";
         }
         
      }
      
      gr.u_details = qna;

      // ( Call to update will act as insert, if rec does not exist )
      gr.update();
      
   },
   
   //-------------------------------------------------------
   saveSessionEvent: function( se, seq ) {
   //-------------------------------------------------------
      
      var i, gsno;
      var session_id = this.grSession.sys_id.toString();
      var gr = new GlideRecord('u_tu_bg_session_event');
      gr.addQuery('u_session',session_id);
      gr.addQuery('u_seq_no',seq);
      gr.query();
      
      if ( !gr.next() ) {
         // Record not found, so initialise object
         gr.initialise();
         gr.u_session = session_id;
         gr.u_seq_no = seq;
      }
      
      gr.u_event_type = se["@event_type"];
      gr.u_event_time = this.getGlideDateTime( se["@timestamp"] );
      
      gr.u_destination = this.findActorId( se.destination );
      gr.u_performed_by = this.findActorId( se.performed_by );
      
      // Both body and data elements are saved to the u_data field
      var body = se.body;
      if ( body ) {
         gr.u_data = body;
      }
      if ( se.data && se.data.value ) {
         var data_values = this.ensureArray( se.data.value );
         var data_text = '';
         for (i=0;i<data_values.length;i++) {
            data_text += '\n' + data_values[i]['@name'] + ' : ' + data_values[i]['@value'];
         }
         gr.u_data = data_text;
      }
      
      // ( Call to update will act as insert, if rec does not exist )
      gr.update();
      
   },
   
   //-------------------------------------------------------
   saveSupportTeams: function( teams ) {
   //-------------------------------------------------------

      //  /support_teams
     
      var i;
      if ( teams.support_team ) {
         var support_teams = this.ensureArray(teams.support_team);
         for ( i=0; i<support_teams.length; i++ ) {
            this.saveSupportTeam( support_teams[i] );
         }
      }

   },
   
   //-------------------------------------------------------
   saveSupportTeam: function( team ) {
   //-------------------------------------------------------
      
      //  /support_teams/support_team
      
      var i, msg = "saveSupportTeam";
      var team_id = team['@id'];
      
      var gr = new GlideRecord('u_tu_bg_team');
      gr.addQuery('u_appliance',this.appliance_id);
      gr.addQuery('u_team_id',team_id);
      gr.query();
      
      if ( !gr.next() ) {
         // Record not found, so initialise object
         gr.initialise();
         gr.u_appliance = this.appliance_id;
         gr.u_team_id = team_id;
      }
      
      gr.u_name = team.name;

      // ( Call to update will act as insert, if rec does not exist )
      gr.update();
      
      // Add members
      
      // Add issues
      
   },
   
   //----------------------------------------------------------------------------
   // The following functions deal with finding and creating Bomgar records
   //----------------------------------------------------------------------------
   //
   //-------------------------------------------------------
   createSession: function( lsid, task_no ) {
   //-------------------------------------------------------
      // Returns a GlideRecord object for the created Bomgar Session

      var msg = "createSession";

      // Return existing session, if it exists
      var gr = this.findSession(lsid);
      if ( gr ) { 
         msg += "\nFound existing session: " + gr.getDisplayValue();
         this.log.logInfo(msg);
         return gr; 
      } else {
         // Reset error message if not found
         this.errorMessage = null;
      }
      
      gr = new GlideRecord('u_tu_bg_session');
      gr.u_appliance = this.grAppliance.sys_id.toString();
      gr.u_lsid = lsid;
      gr.u_task = this.findTaskId( task_no );
      gr.u_display_name = "New Session";
      var session_id = gr.insert();
      
      if ( session_id ) {
         this.grSession = gr;
         msg += "\nCreated Session: " + gr.getDisplayValue();
         this.log.logInfo(msg);
         return gr;
      } else {
         this.errorMessage = "Failed to create session with lsid [" + lsid + "]";
         return null;
      }
      
   },
   
   //-------------------------------------------------------
   findSession: function( lsid ) {
   //-------------------------------------------------------
      // Returns a GlideRecord object for the Session
      
      var gr = new GlideRecord('u_tu_bg_session');
      gr.addQuery('u_appliance',this.appliance_id);
      gr.addQuery('u_lsid',lsid);
      gr.query();
      
      if ( gr.next() ) {
         // Session found, get ref and return
         this.grSession = gr;
         return gr;
      } else {
         this.log.logWarning( "Session not found, lsid: [" + lsid + "]" );
         this.grSession = null;
         return null;
      }
      
   },
   
   //-------------------------------------------------------
   findActorId: function( item ) {
   //-------------------------------------------------------
      // Returns the sys_id of the Bomgar Actor record

      // item:  //event/destination or //event/performed_by
      
      // This routine finds (and caches) sys_ids of Actors
      // for the current Session. It will create System Actor
      // records, if they do not exist, but it will not create
      // Customers or Reps.

      // We can get called for non-existant elements, so protect 
      // ourselves from that.
      if ( !item ) { return null; }

      var msg = "findActorId";
      
      // Extract expected information from object
      var actor_name = item['#text'];
      var actor_type = item['@type'];
      var actor_gsno = item['@gsnumber'];
      var actor_id, actor_key;

      msg += "\n " + actor_gsno + " : " + actor_type + " : " + actor_name;
      
      if ( actor_gsno != "0" ) {
         // This is a Customer or Rep lookup
         actor_key = 'gs' + actor_gsno;
         msg += "\nActor Key: " + actor_key;
         actor_id = this.sessionActors[actor_key];
         if ( !actor_id ) {
            msg += "\nCust or Rep: not found in cache" 
            actor_id = this.findSessionActorId( actor_gsno );
         }
      } else {
         // This is a System Actor lookup
         actor_key = actor_type + "_" + actor_name;
         msg += "\nActor Key: " + actor_key;
         actor_id = this.sessionActors[actor_key];
         if ( !actor_id ) {
            msg += "\nSystem: not found in cache" 
            actor_id = this.findSystemActorId( actor_type, actor_name );
         }
      }

      msg += "\nActor Id: " + actor_id;
      this.log.logDebug(msg);
      
      return actor_id;
   },
      
   //-------------------------------------------------------
   findSessionActorId: function( actor_gsno ) {
   //-------------------------------------------------------

      // This routine finds a Bomgar Session Actor record 
      // and caches the resulting sys_id for future lookups.
      // It does not create a record if the Actor is not found.
      
      var session_id = this.grSession.sys_id.toString();
      var actor_id, gr;
      
      // Find the Actor record
      gr = new GlideRecord('u_tu_bg_session_actor');
      gr.addQuery('u_session',session_id);
      gr.addQuery('u_gsnumber',actor_gsno);
      gr.query();
      
      if ( gr.next() ) {
         actor_id = gr.sys_id.toString();
      } else {
         this.log.logWarning( "Session Actor not found, gsnumber: [" + actor_gsno + "]" );
         actor_id = null;
      }
      
      // Cache and return the id
      this.sessionActors['gs'+actor_gsno] = actor_id;
      return actor_id;

   },
   
   //-------------------------------------------------------
   findSystemActorId: function( actor_type, actor_name ) {
   //-------------------------------------------------------

      // This routine finds or creates a Bomgar System Actor record 
      // and caches the resulting sys_id for future lookups
      
      // Build key from data
      var actor_key = actor_type + '_' + actor_name;
      var actor_id;
         
      var gr = new GlideRecord('u_tu_bg_system_actor');
      gr.addQuery('u_appliance',this.appliance_id);
      gr.addQuery('u_actor_type', actor_type);
      gr.addQuery('u_display_name', actor_name);
      gr.query();
      
      if ( gr.next() ) {
         actor_id = gr.sys_id.toString();
      } else {
         // Create a new System Actor
         gr.initialise();
         gr.u_appliance = this.appliance_id;
         gr.u_actor_type = actor_type;
         gr.u_display_name = actor_name;
         gr.u_gsnumber = '0';
         actor_id = gr.insert();

         this.log.logNotice("Created new Bomgar System Actor:\n" + 
                            actor_name + " (" + actor_type + ")" );

      }
      
      // Cache and return the id
      this.sessionActors[actor_key] = actor_id;
      return actor_id;
      
   },
   
   //-------------------------------------------------------
   findRepId: function( rep ) {
   //-------------------------------------------------------
      // Returns the sys_id of the Bomgar Rep record

      var rep_sys_id, rep_id = rep['@id'];
      if (!rep_id) { return null; }

      var gr = new GlideRecord('u_tu_bg_rep');
      gr.addQuery('u_appliance', this.appliance_id);
      gr.addQuery('u_rep_id',rep_id);
      gr.query();
      
      if ( gr.next() ) {
         // Rep found, record sys_id
         rep_sys_id = gr.sys_id.toString();
      } else {
         // Record not found, so let's create one
         gr.initialise();
         gr.u_appliance = this.appliance_id;
         gr.u_rep_id = rep_id;
         gr.u_name = rep.display_name;
         gr.u_username = rep.username;
         rep_sys_id = gr.insert();
         
         this.log.logNotice("Created new Bomgar Rep\n" + 
                             rep.display_name + " (" + rep.username + ")" );
      }
      
      return rep_sys_id;
      
   },
   
   //-------------------------------------------------------
   findTaskId: function( task_no ) {
   //-------------------------------------------------------
      // Returns the sys_id of the task record

      var task_id, msg = "findTaskId";
      msg += "\nTask number: [" + task_no + "]";
      var gr = new GlideRecord('task');
      gr.addQuery('number', task_no);
      gr.query();
      msg += "\nFound " + gr.getRowCount() + " tasks";

      if ( gr.next() ) {
         // Task found, return sys_id
         return gr.sys_id.toString();
      } else {
         this.log.logWarning( "Task not found, task number: [" + task_no + "]" );
         return null;
      }
   },
   
   //----------------------------------------------------------------------------
   // The following utility functions assist the main functions above.
   //----------------------------------------------------------------------------
   //
   //-------------------------------------------------------
   ensureArray: function( item ) {
      // Sequences of XML elements of the same type are converted into JavaScript
      // Arrays with each element being an instance of the element object. However,
      // if an element appears only once it will be presented as a single object. 

      // This conversion routine ensures that any elements that may appear one or 
      // more times are converted into an array, even if the array consists of
      // only a single element.

      // Ensure that we have an array
      if ( this._is_array(item) ) {
         return item;
      } else {
         var item_array = [];
         if (item) {
            item_array.push(item);
         }
         return item_array;
      }
      
   },
   
   //-------------------------------------------------------
   _is_array: function(v) {
      return Object.prototype.toString.apply(v) === '[object Array]';
   },
   
   type: 'BomgarAPI'
   
};
