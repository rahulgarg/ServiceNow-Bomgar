var BomgarEvent = Class.create();

BomgarEvent.prototype = {
   
   initialize: function() {
      this.log = new GSLog('tu.bomgar.loglevel.event', 'Bomgar Event');
      this.tasks_only = gs.getProperty( 'tu.bomgar.event.tasks.only', 'false' );
      this.errorMessage = '';
      this.warningMessage = '';
   },
   
   validate_params: function() {
      
      this.src_ip = '' + gs.getSession().getClientIP().toString();
      var msg = "Bomgar Event from source IP [" + this.src_ip + "]";
      
      // Collect parameters
      this.event = '' + RP.getParameterValue('event');
      this.version = '' + RP.getParameterValue('version');
      this.timestamp = '' + RP.getParameterValue('timestamp');
      this.appliance_id = '' + RP.getParameterValue('appliance_id');
      //
      this.lsid = '' + RP.getParameterValue('lsid');
      this.ext_key = '' + RP.getParameterValue('external_key');
      //
      this.username = '' + RP.getParameterValue('username');
      this.user_id = '' + RP.getParameterValue('user_id');
      this.display_name = '' + RP.getParameterValue('display_name');
      this.member_type = '' + RP.getParameterValue('type');
      this.conf_name = '' + RP.getParameterValue('conference_name');
      this.conf_id = '' + RP.getParameterValue('conference_id');
      
      if ( this.log.debugOn() ) {
         var pmsg = "\nParams:";
         pmsg += "\n : event=[" + this.event + "]";
         pmsg += "\n : version=[" + this.version + "]";
         pmsg += "\n : timestamp=[" + this.timestamp + "]";
         pmsg += "\n : --------------------------------------";
         pmsg += "\n : appliance_id=[" + this.appliance_id + "]";
         pmsg += "\n : external_key=[" + this.ext_key + "]";
         pmsg += "\n : lsid=[" + this.lsid + "]";
         pmsg += "\n : --------------------------------------";
         pmsg += "\n : username=[" + this.username + "]";
         pmsg += "\n : user_id=[" + this.user_id + "]";
         pmsg += "\n : display_name=[" + this.display_name + "]";
         pmsg += "\n : type=[" + this.member_type + "]";
         pmsg += "\n : conference_name=[" + this.conf_name + "]";
         pmsg += "\n : conference_id=[" + this.conf_id + "]";
         this.log.logDebug(msg+pmsg);
      }
      
      // Validate presence of essential params
      var ev_err = false, ev_warn = false;
      if (!this.event)        { msg += "\nParam missing: event"; ev_err = true; }
      if (!this.version)      { msg += "\nParam missing: version"; ev_err = true; }
      if (!this.timestamp)    { msg += "\nParam missing: timestamp"; ev_err = true; }
      if (!this.lsid)         { msg += "\nParam missing: lsid"; ev_err = true; }
         
      if ( this.tasks_only ) {
         // Check that external_key is a valid task
         if ( this.ext_key ) {
            this.task_id = this.findTaskId( this.ext_key );
            if ( !this.task_id ) {
               msg += "\nThe supplied external_key [" + this.ext_key + "] is not a valid task";
               this.log.logError(msg);
               ev_err = true;
            }
         } else { 
            // No External Key was supplied and we only want to process sessions
            // that have a key, so ignore this event.
            msg += "\nWarning - Param missing: external_key";
            this.errorMessage = msg;
            this.log.logInfo(msg);  // Log as Info to prevent cluttering up logfile
            return null;
         }
      }

      // Validate appliance identifier
      if ( this.appliance_id ) {
         try {
            this.bomgarAPI = new BomgarAPI( this.appliance_id );
         } catch(e) {
            msg += "\nFailed to initialise Bomgar API\n" + e.name + "\n" + e.message;
            ev_err = true;
         }
      } else {
         msg += "\nParam missing: appliance_id";
         ev_err = true; 
      }
      
      // Log error and abort, if there were any errors
      if ( ev_err ) {
         this.errorMessage = msg;
         this.log.logError(msg);
         return null;
      }
      
      return msg;
      
   },
   
   process_event: function() {
      
      var bg, survey;
      if (this.bomgarAPI) {
         bg = this.bomgarAPI;
      } else {
         return null;
      }
      
      var msg = "Bomgar Event from source IP [" + this.src_ip + "]";
      msg += "\nEvent type: " + this.event;
      msg += "\nLSID: " + this.lsid;
      
      // Process request based upon event type
      switch (this.event) {
         
       case 'support_conference_begin' :
         
         // Get the report 30 secs from now
         var run_at = new GlideDateTime();
         run_at.addSeconds(30);
         
         // Get the Session record
         this.bomgarSession = bg.createSession( this.lsid, this.ext_key );
         if ( this.bomgarSession ) {
            msg += "\nBomgar Session created and update event scheduled.";
            gs.eventQueueScheduled('bomgar.session.start', this.bomgarSession, 
                              this.appliance_id, this.lsid, run_at);
         } else {
            msg += "Failed to create Bomgar Session record";
            this.errorMessage = msg;
            this.log.logError(msg);
            return null;
         }
         break;
         
       case 'support_conference_end' :
         
         // Collect Session and Event data from Bomgar
         var session = bg.retrieveSession(this.lsid);
         if (!session) {
            msg += "\nFailed to obtain details of session [" + this.lsid + "]";
            msg += "\n" + bg.errorMessage;
            this.errorMessage = msg;
            this.log.logError(msg);
            return null;
         }
         bg.saveSession(session);
         msg += "\nSaved Session : [" + bg.getSessionName() + "]";
         break;

       case 'support_conference_member_added' :
       case 'support_conference_member_departed' :
       case 'support_conference_owner_changed' :
         // Do nothing?
         break;

       case 'support_conference_rep_exit_survey_completed' :

         // Retrieve survey from Bomgar
         survey = bg.retrieveExitSurvey( this.lsid, 'rep' );
         if ( survey ) {
            bg.saveExitSurvey( survey );
         }
         break;
         
       case 'support_conference_customer_exit_survey_completed' :

         // Retrieve survey from Bomgar
         survey = bg.retrieveExitSurvey( this.lsid, 'cust' );
         if ( survey ) {
            bg.saveExitSurvey( survey );
         }
         break;
         
       default:
         msg += "\nUnknown event type : [" + this.event + "]";
         this.errorMessage = msg;
         this.log.logError(msg);
         return null;
      }
      
      this.log.logInfo(msg);
      return msg;
      
   },
   
   findTaskId: function( task_no ) {
      // Returns the sys_id of the task record

      var task_id, msg = "findTaskId";
      msg += "\nTask number: [" + task_no + "]";
      var gr = new GlideRecord('task');
      gr.addQuery('number', task_no);
      gr.query();
      msg += "\nFound " + gr.getRowCount() + " tasks";

      if ( gr.next() ) {
         // Task found, return sys_id
         this.log.logDebug("\nTask found.");
         return gr.sys_id.toString();
      } else {
         this.errorMessage = "Failed to find task number [" + task_no + "]";
         this.log.logDebug("\nTask NOT found.");
         return null;
      }
   },
   
   type: 'BomgarEvent'
   
};
