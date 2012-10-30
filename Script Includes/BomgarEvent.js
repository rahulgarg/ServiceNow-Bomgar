var BomgarEvent = Class.create();

BomgarEvent.prototype = {
   
   initialize: function() {
      this.log = new GSLog('tu.bomgar.loglevel', 'Bomgar Event');
      this.errMessage = '';
      this.warnMessage = '';
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
         pmsg += "\n : lsid=[" + this.lsid + "]";
         pmsg += "\n : external_key=[" + this.ext_key + "]";
         pmsg += "\n : --------------------------------------";
         pmsg += "\n : username=[" + this.username + "]";
         pmsg += "\n : user_id=[" + this.user_id + "]";
         pmsg += "\n : display_name=[" + this.display_name + "]";
         pmsg += "\n : type=[" + this.member_type + "]";
         pmsg += "\n : conference_name=[" + this.conf_name + "]";
         pmsg += "\n : conference_name=[" + this.conf_id + "]";
         this.log.logDebug(msg+pmsg);
      }
      
      // Validate presence of essential params
      var ev_err = false, ev_warn = false;
      if (!this.event)        { msg += "\nParam missing: event"; ev_err = true; }
      if (!this.version)      { msg += "\nParam missing: version"; ev_err = true; }
      if (!this.timestamp)    { msg += "\nParam missing: timestamp"; ev_err = true; }
      if (!this.appliance_id) { msg += "\nParam missing: appliance_id"; ev_err = true; }
      if (!this.lsid)         { msg += "\nParam missing: lsid"; ev_err = true; }
      if (!this.ext_key)      { msg += "\nWarning - Param missing: external_key"; ev_warn = true; }
         
      // Validate appliance
      var bg;
      try {
         this.bomgarAPI = new BomgarAPI( this.appliance_id );
      } catch(e) {
         msg += "\nFailed to initialise Bomgar API\n" + e.name + "\n" + e.message;
         ev_err = true;
      }
      
      // Log error and abort, if there were any errors
      if ( ev_err ) {
         this.errMessage = msg;
         this.log.logError(msg);
         return null;
      }
      
      // Log warning, but continue
      if ( ev_warn ) {
         this.warnMessage = msg;
      }
      
      msg += "\nParameters and Appliance ID are valid";
      this.log.logInfo(msg);
      return msg;
      
   },
   
   process_event: function() {
      
      var bg;
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
         this.bomgarSession = bg.findSession( this.lsid );
         msg += "\nSession: " + bg.getSessionName();
         
         gs.eventQueueScheduled('bomgar.session.start', this.bomgarSession, this.appliance_id, this.lsid, run_at);
         break;
         
         case 'support_conference_end' :
         // Collect Session and Event data from Bomgar
         var session = bg.getSession(this.lsid);
         if (!session) {
            msg += "\nFailed to obtain details of session [" + this.lsid + "]";
            msg += "\n" + bg.errMessage;
            this.log.logError(msg);
            return msg;
         }
         bg.saveSession(session);
         msg += "\nSaved Session : [" + bg.getSessionName() + "]";
         this.log.logInfo(msg);
         break;
         /*
         case 'support_conference_member_added' :
         msg += "Session member ended";
         // Do nothing?
         break;
         
         case 'support_conference_member_departed' :
         msg += "Session member departed";
         // Do nothing?
         break;
         
         case 'support_conference_owner_changed' :
         msg += "Session owner changed";
         // Do nothing?
         break;
          */
         case 'support_conference_rep_exit_survey_completed' :
         // Retrieve survey from Bomgar
         var survey = bg.getExitSurvey( this.lsid, 'rep' );
         if ( survey ) {
            bg.saveExitSurvey( survey );
         }
         break;
         
         case 'support_conference_customer_exit_survey_completed' :
         // Retrieve survey from Bomgar
         var survey = bg.getExitSurvey( this.lsid, 'cust' );
         if ( survey ) {
            bg.saveExitSurvey( survey );
         }
         break;
         
         default:
         msg += "\nUnknown event type : [" + this.event + "]";
         this.log.logError(msg);
         return msg;
      }
      
      this.log.logInfo(msg);
      return msg;
      
   },
   
   type: 'BomgarEvent'
   
};
