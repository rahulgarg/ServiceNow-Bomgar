var BomgarAPI = Class.create();
BomgarAPI.prototype = {
   
   initialize: function( appliance ) {
      this.log = new GSLog('tu.bomgar.loglevel','Bomgar API');
      
      // Use 'teamultra.bomgar.com' as the default appliance
      if ( !appliance ) {
         appliance = 'teamultra.bomgar.com';
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
      this.bgConn = new BomgarConnection(app);
	  this.sessionActors = [];
	  this.systemActors = {};
      
   },
   
   //----------------------------------------------------------------------------
   // The following ( mostly getXXX ) functions retrieve information from the Bomgar
   // appliance. Data is returned as a JavaScript object which reflects the structure
   // of the XML document returned by the Bomgar API.
   //----------------------------------------------------------------------------
   //
   generateSessionKey: function(task_no) {
      var pa = [];  // Param array
      pa.push( [ "action", "generate_session_key" ] );
      pa.push( [ "type", "support" ] );
      pa.push( [ "queue_id", "general" ] );
      pa.push( [ "external_key", task_no ] );
      return this.bgConn.sendCommand(pa);
   },
/*   
   startSession: function(task_no) {
      var pa = [];  // Param array
      pa.push( [ "action", "generate_session_key" ] );
      pa.push( [ "type", "support" ] );
      pa.push( [ "queue_id", "general" ] );
      pa.push( [ "external_key", task_no ] );
      return this.bgConn.startSession(pa);
   },
*/   
   getApiInfo: function() {
      var pa = [];  // Param array
      pa.push( [ "action", "get_api_info" ] );
      return this.bgConn.sendCommand(pa);
   },
   
   getLoggedInReps: function() {
      var pa = [];  // Param array
      pa.push( [ "action", "get_logged_in_reps" ] );
      return this.bgConn.sendCommand(pa);
   },
   
   getSupportTeams: function( showmembers ) {
      var pa = [];  // Param array
      pa.push( [ "action", "get_support_teams" ] );
	  if (showmembers) {
		 pa.push( [ "showmembers", "1" ] );
	  }
      return this.bgConn.sendCommand(pa);
   },
   
   getSessionList: function() {
      var pa = [];  // Param array
      pa.push( [ "generate_report", "SupportSessionListing" ] );
      return this.bgConn.getReport(pa);
   },
   
   getSessionSummary: function() {
      var pa = [];  // Param array
      pa.push( [ "generate_report", "SupportSessionSummary" ] );
      pa.push( [ "report_type", "rep" ] );
      return this.bgConn.getReport(pa);
   },
   
   getTestSurveys: function() {
      var pa = [];  // Param array
      pa.push( [ "generate_report", "SupportCustExitSurvey" ] );
      pa.push( [ "start_date", "2012-09-01" ] );
      pa.push( [ "duration", "0" ] );
      pa.push( [ "report_type", "rep" ] );
      pa.push( [ "id", "all" ] );
      return this.bgConn.getReport(pa);
   },
   
   getExitSurvey: function( lsid, survey_type ) {

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
      pa.push( [ "duration", "10" ] );	// Search within 10 sec window
      pa.push( [ "report_type", "rep" ] );
      pa.push( [ "id", "all" ] );

      var esl = this.bgConn.getReport(pa);
      var root = this.bgConn.responseRoot;
      
      if ( root == 'exit_survey_list' ) {
         if ( esl.exit_survey ) {
            // All's well, return the survey object(s)
            return esl.exit_survey;
         } else if ( esl.error ) {
            // Record the returned error
            this.errMessage = esl.error.toString();
            return null;
         } else {
            // No error, but no sessions either
            this.errMessage = "No exit surveys found";
            return null;
         }
         
      } else {
         // We should never get here
         this.errMessage = "Unknown XML root element [" + root + "]";
         msg += "\n" + this.errMessage;
         this.log.logError(msg);
         return null;
      }
      
   },
   
   getSession: function( lsid ) {
      
      var msg = "getSession( " + lsid + " )";
      var pa = [];  // Param array
      pa.push( [ "generate_report", "SupportSession" ] );
      pa.push( [ "lsid", lsid ] );
      var sl = this.bgConn.getReport(pa);
      
      var root = this.bgConn.responseRoot;
      
      if ( root == 'session_list' ) {
         if ( sl.session ) {
            // All's well, return the session object
            return sl.session;
         } else if ( sl.error ) {
            // Record the returned error
            this.errMessage = sl.error.toString();
            return null;
         } else {
            // No error, but no sessions either
            this.errMessage = "No sessions found";
            return null;
         }
         
      } else {
         // We should never get here
         this.errMessage = "Unknown XML root element [" + root + "]";
         msg += "\n" + this.errMessage;
         this.log.logError(msg);
         return null;
      }
      
   },

   getSessionName: function() {
	  if (this.grSession) {
		 return this.grSession.u_display_name.toString();
	  } else {
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
   saveSession: function( session ) {
      
      // session:  /session_list/session
      
      var i, msg = "saveSession";
      var lsid = session["@lsid"];
	  if (!lsid) { return null; }
      var gr = this.findSession(lsid);
      
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
      
      // A temporary lookup table to map gsnumber to sys_id
      this.sessionActors = [];
      
      // Save Customer
      if ( session.customer_list ) {
		 var cust = session.customer_list.customer;
		 if ( cust ) {
			this.saveSessionCust( cust );
		 }
	  }
      
      // Save Session Reps
      if ( session.rep_list ) {
         var reps = session.rep_list.representative;
         if ( reps ) {
            if ( this._is_array(reps) ) {
               for ( i=0; i<events.length; i++ ) {
                  this.saveSessionRep( reps[i] );
               }
            } else {
               this.saveSessionRep( reps );
            }
         }
      }
      
      // Update primary actors and compose name
      var pri_cust = session.primary_customer;
      var pri_cust_name, pri_cust_no;
      if ( pri_cust && pri_cust['#text'] ) {
         pri_cust_name = pri_cust['#text'];
         pri_cust_no = pri_cust['@gsnumber'];
      } else {
         pri_cust = 'no_customer';
      }
      var pri_rep = session.primary_rep;
      var pri_rep_name, pri_rep_no;
      if ( pri_rep && pri_rep['#text'] ) {
         pri_rep_name = pri_rep['#text'];
         pri_rep_no = pri_rep['@gsnumber'];
      } else {
         pri_rep = 'no_rep';
      }
      
      if (pri_cust_no) {
         gr.u_primary_customer = this.sessionActors[ pri_cust_no ];
      }
      if (pri_rep_no) {
         gr.u_primary_rep = this.sessionActors[ pri_rep_no ];
      }
      gr.u_display_name = 'For ' + pri_cust_name + ' by ' + pri_rep_name;
      
      gr.update();
      
      // Save Customer Survey
      if ( session.cust_survey_list && session.cust_survey_list.cust_exit_survey ) {
         this.saveSessionSurvey( session.cust_survey_list.cust_exit_survey, 'cust' );
      }
      
      // Save Rep Surveys
      if ( session.rep_survey_list ) {
         var rep_surveys = session.rep_survey_list.rep_exit_survey;
         if ( rep_surveys ) {
            if ( this._is_array(rep_surveys) ) {
               for ( i=0; i<rep_surveys.length; i++ ) {
                  this.saveSessionSurvey( rep_surveys[i], 'rep' );
               }
            } else {
               this.saveSessionSurvey( rep_surveys, 'rep' );
            }
         }
      }
      
      // Save Session Events
      var events = session.session_details.event;
      for ( i=0; i<events.length; i++ ) {
         this.saveSessionEvent( events[i], i );
      }
      
   },
   
   saveSessionCust: function( cust ) {

      // cust:  /session_list/session/customer_list/customer
      
      var i, newrec = false;
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
         newrec = true;
      }
      
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
      
      var cust_id;
      if ( newrec ) {
         cust_id = gr.insert();
      } else {
         cust_id = gr.update();
      }
      
      this.sessionActors[gsno] = cust_id;
      
   },
   
   saveSessionRep: function( rep ) {

      // rep:  /session_list/session/rep_list/representative
      
      var i, newrec = false;
	  var session_id = this.grSession.sys_id.toString();
      var gsno = rep['@gsnumber'];
      if ( !gsno ) { return null; }
         
      var rep_id = this.findRepSysId(rep);
      
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
         newrec = true;
      }
      
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
      
	  var session_rep_id;
      if ( newrec ) {
         session_rep_id = gr.insert();
      } else {
         session_rep_id = gr.update();
      }
      
      this.sessionActors[gsno] = session_rep_id;
      
   },
   
   saveSessionSurvey: function( survey, type ) {
      
      // survey : /session_list/session/cust_survey_list/cust_exit_survey
      //       or /session_list/session/rep_survey_list/rep_exit_survey
      // type : 'cust' or 'rep'
      
      var i, newrec = false;
	  var session_id = this.grSession.sys_id.toString();
      var gsno = survey['@gsnumber'];
      if ( !gsno ) { return null; }
         
      var gr = new GlideRecord('u_tu_bg_exit_survey');
      gr.addQuery('u_session',session_id);
      gr.addQuery('u_gsnumber',gsno);
      gr.query();
      
      if ( !gr.next() ) {
         // Record not found, so initialise object
         gr.initialise();
         gr.u_session = session_id;
         gr.u_gsnumber = gsno;
         newrec = true;
      }
      
      // Populate Submitted By depending on type of survey
	  gr.u_survey_type = type;
      if ( type == 'cust' ) {
         gr.u_submitted_by = this.sessionActors[gsno];
      } else {
         gr.u_submitted_by_rep = this.sessionActors[gsno];
      }
      
      // Ensure that the values are presented as an array
      var va = [];
      if ( this._is_array(survey.value) ) {
         va = survey.value;
      } else if ( survey.value ) {
         va.push( survey.value );
      }
      
      // Initialise details, if we have any values
      if ( va.length > 0 ) {
         gr.u_details = '';
      }
      
      // Process the array of values
      var nam, val, txt, j;
      for ( i=0; i < survey.value.length; i++ ) {
         nam = va[i]['@name'];
         val = va[i]['@value'];
         val = val.replace(/\\n/g,'\n');  // Re-introduce proper newline characters
         if ( nam == 'rating' ) {
            gr.u_rating = val;
         } else if ( nam == 'comments' ) {
            gr.u_comments = val;
         } else {
            gr.u_details += '\n' + nam + ':\t' + val;
         }
      }
      
      // Save the survey record
      var survey_id;
      if ( newrec ) {
         survey_id = gr.insert();
      } else {
         survey_id = gr.update();
      }
      
   },
   
   saveExitSurvey: function( survey ) {
      
      // survey : /exit_survey_list/exit_survey

      var gsno, i, newrec = false;
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
         newrec = true;
      }
      
      // Populate Survey record
	  var survey_type = survey.submitted_by['@type'];
      gr.u_survey_type = survey_type;
      gr.u_survey_time = this.getGlideDateTime(survey);
	  if ( survey_type == 'rep' ) {
		 gr.u_submitted_by = this.findSessionActor(survey.primary_rep);
	  } else {
		 gr.u_submitted_by = this.findSessionActor(survey.primary_customer);
	  }
	  
	  // Populate Questions and Answers
	  var qa = [], ql = survey.question_list.question;
	  if ( this._is_array(ql) ) {
		 qa = ql;
	  } else {
		 qa.push(ql);
	  }
	  
	  // Process questions and answers
	  var qna = '', q, q_no, q_name, ans, i;
	  for ( i=0; i<qa.length; i++ ) {
		 q = qa[i]; q_no = q['@id'];
		 qna += "Q" + q_no + ".\t(" + q.type + ")\t" + q.label +"\n";
		 ans = q.answer_list.answer;
         ans = ans.replace(/\\n/g,'');  // Strip redundant escaped newline characters
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
      
      var survey_id;
      if ( newrec ) {
         survey_id = gr.insert();
      } else {
         survey_id = gr.update();
      }
      
   },
   
   saveSessionEvent: function( se, seq ) {
      
      var i, gsno, newrec = false;
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
         newrec = true;
      }
      
      gr.u_event_type = se["@event_type"];
      gr.u_event_time = this.getGlideDateTime( se["@timestamp"] );
      
	  gr.u_destination = this.findSessionActor(se.destination);
	  gr.u_performed_by = this.findSessionActor(se.performed_by);
      
      // Both body and data elements are saved to the u_data field
      var body = se.body;
      if ( body ) {
         gr.u_data = body;
      }
      var data = se.data.value;
      if ( data ) {
         if ( this._is_array(data) ) {
            var val = '';
            for (i=0;i<data.length;i++) {
               val += '\n' + data[i]['@name'] + ' : ' + data[i]['@value'];
            }
            gr.u_data = val;
         } else {
            gr.u_data = data['@name'] + ' : ' + data['@value'];
         }
      }
      
      if ( newrec ) {
         gr.insert();
      } else {
         gr.update();
      }
      
   },

   saveSupportTeams: function( teams ) {
      //  /support_teams
	  
	  // todo: Need to check that support_team is an array
	  
	  var i;
	  for ( i=0; i<teams.support_team.length; i++ ) {
		 this.saveSupportTeam( teams.support_team[i] );
	  }
   },
   
   saveSupportTeam: function( team ) {

      //  /support_teams/support_team

      var i, msg = "saveSupportTeam";
      var appliance_id = this.grAppliance.sys_id.toString();
	  var team_id = team['@id'];
      
      var gr = new GlideRecord('u_tu_bg_team');
      gr.addQuery('u_appliance',appliance_id);
      gr.addQuery('u_team_id',team_id);
      gr.query();
      
      if ( !gr.next() ) {
         // Record not found, so initialise object
         gr.initialise();
         gr.u_appliance = appliance_id;
         gr.u_team_id = team_id;
         newrec = true;
      }

      gr.u_name = team.name;
	  
      if ( newrec ) {
         gr.insert();
      } else {
         gr.update();
      }

      // Add members
	  
	  // Add issues
      
   },
   
   //----------------------------------------------------------------------------
   // The following utility functions assist the main functions above.
   //----------------------------------------------------------------------------
   //
   findSession: function( lsid ) {
      
      var i, msg = "findSession";
      var appliance_id = this.grAppliance.sys_id.toString();
      msg += "\nAppliance ID: ["+appliance_id+"]";
      msg += "\nLSID: [" + lsid + "]";
      
      var gr = new GlideRecord('u_tu_bg_session');
      gr.addQuery('u_appliance',appliance_id);
      gr.addQuery('u_lsid',lsid);
      gr.query();
      
      if ( gr.next() ) {
         // Session found, get ref and return
         msg += "\nFound Session: " + gr.getDisplayValue();
         this.log.logInfo(msg);
         this.grSession = gr;
         return gr;
      }
      
      // No session was found, so create new record
      gr = new GlideRecord('u_tu_bg_session');
      gr.u_appliance = this.grAppliance.sys_id.toString();
      gr.u_lsid = lsid;
      gr.u_display_name = "New session";
      var session_id = gr.insert();
      
      // Re-query table to return record object suitable for update
      gr = new GlideRecord('u_tu_bg_session');
      gr.get(session_id);
      msg += "\nCreated Session: " + gr.getDisplayValue();
      this.log.logInfo(msg);
      this.grSession = gr;
      return gr;
      
   },
   
   findSessionActor: function( obj ) {

	  // This routine finds (and caches sys_ids of) Actors 
	  // for the current Session. It does not create records
	  // if the Actor is not found.

	  // Return immediately if object is not valid
	  if (!obj) { return null; }
	  
	  var msg = "findSessionActor";
	  
	  // Extract expected information from object
      var actor_name = obj['#text']; 
      var actor_type = obj['@type'];
      var actor_gsno = obj['@gsnumber'];
	  var actor_id, gr;
	  
	  msg += "\nName:["+actor_name+"], type:["+actor_type+"], GSno:["+actor_gsno+"]";
	  
	  // Return cached value, if present
	  if ( actor_gsno && this.sessionActors[actor_gsno] ) {
		 msg += "\nMatching Session Actor found in cache";
		 this.log.logDebug(msg);
		 return this.sessionActors[actor_gsno];
	  }
	  if ( actor_name && this.systemActors[actor_name] ) {
		 msg += "\nMatching System Actor found in cache";
		 this.log.logDebug(msg);
		 return this.systemActors[actor_name];
	  }
	  
	  if ( actor_gsno && actor_gsno != "0" ) {
		 msg += "\nLookup Session Actor";
		 this.log.logDebug(msg);
		 // Find the Actor record
		 var session_id = this.grSession.sys_id.toString();
		 gr = new GlideRecord('u_tu_bg_session_actor');
		 gr.addQuery('u_session',session_id);
		 gr.addQuery('u_gsnumber',actor_gsno);
		 gr.query();
		 if (gr.next()) {
			this.sessionActors[actor_gsno] = gr.sys_id.toString();
			return this.sessionActors[actor_gsno];
		 } else {
			return null;
		 }

	  } else if ( actor_name ) {
		 msg += "\nLookup System Actor";
		 // This must be a Session actor, with gsno of zero
		 // Lookup this type of Actor by name
		 gr = new GlideRecord('u_tu_bg_session_actor');
		 gr.addNullQuery('u_session'); // System Actors have no session
		 gr.addQuery('u_display_name',actor_name);
		 gr.query();
		 msg += "\nFound matching " + gr.getRowCount() + " System Actors";
		 if (gr.next()) {
			this.systemActors[actor_name] = gr.sys_id.toString();
			msg += "\nMatching SysID: ["+gr.sys_id.toString()+"] ["+this.systemActors[actor_name]+"]";
			this.log.logDebug(msg);
			return this.systemActors[actor_name];
		 } else {
			this.log.logDebug(msg);
			return null;
		 }
	  } else {
		 return null;
	  }
	  
   },
   
   findRepSysId: function( rep ) {
      
      var i, newrec = false;
      var appliance_id = this.grAppliance.sys_id.toString();
      var rep_id = rep['@id'];
      var gr = new GlideRecord('u_tu_bg_rep');
      gr.addQuery('u_appliance', appliance_id);
      gr.addQuery('u_rep_id',rep_id);
      gr.query();
      
      if ( gr.next() ) {
         // Rep found, return sys_id
         return gr.sys_id.toString();
      }
      
      // Record not found, so let's create one
      gr.initialise();
      gr.u_appliance = appliance_id;
      gr.u_rep_id = rep_id;
      gr.u_display_name = rep.display_name;
      gr.u_username = rep.username;
      
      return gr.insert();
      
   },
   
   findTaskId: function( task_no ) {
      
      var task_id;
      var gr = new GlideRecord('task');
      gr.addQuery('number', task_no);
      gr.query();
      
      if ( gr.next() ) {
         // Task found, return sys_id
         return gr.sys_id.toString();
      } else {
         return null;
      }
      
   },
   
   getGlideDateTime: function(item) {
      
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
   
   _is_array: function(v) {
      return Object.prototype.toString.apply(v) === '[object Array]';
   },
   
   reloadSessions: function() {
      
      var i, msg = "getSessions";
      var sl = this.getSessionList();
      var ssl = sl.session_summary;
      var lsid, ss;
      msg += "\nSession count: " + ssl.length;
      
      // Get all of the sessions
      for ( i=0; i < ssl.length; i++ ) {
         lsid = ssl[i]["@lsid"];
         msg += "\nSession " + i + ": [" + lsid + "]";
         ss = this.getSession( lsid );
         this.saveSession(ss);
      }
      
      this.log.logInfo(msg);
      
   },
   
   type: 'BomgarAPI'
   
};
