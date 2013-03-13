// This script will only execute if the session has no End Time set
//  i.e. if the Bomgar Session is still in progress

refresh_session_data( event.parm1, event.parm2 );

function refresh_session_data( appliance_id, lsid ) {
   
   var bg, msg = "Bomgar Session Refresh";
   msg += "\nAppliance ID : [" + appliance_id + "]";
   msg += "\nLSID : [" + lsid + "]";

   // Initialise the API
   try {
      bg = new BomgarAPI( appliance_id );
   } catch(e) {
      msg += "\nFailed to initialise Bomgar API\n" + e.name + "\n" + e.message;
      gs.logError(msg,'Bomgar Refresh');
      return null;
   }
   
   // Get the session data
   var session = bg.retrieveSession(lsid);
   if (!session) {
      msg += "\nFailed to obtain details of session";
      msg += "\n" + bg.getErrorMessage();
      gs.logError(msg,'Bomgar Refresh');
      return null;
   }
   
   // Update the Bomgar Session record
   if ( !bg.saveSession(session) ) {
      msg += "\nFailed to save details of session [" + bg.getSessionName() + "]";
      msg += "\n" + bg.getErrorMessage();
      gs.logError(msg,'Bomgar Refresh');
      return null;
   }

   msg += "\nSession refreshed : [" + bg.getSessionName() + "]";

   // Read the refresh interval and set next refresh time
   var refresh_interval = parseInt( gs.getProperty( 'tu.bomgar.session.refresh.interval', '0' ) );
   var run_at = new GlideDateTime();
   run_at.addMinutes( refresh_interval );

   // Schedule the next refresh, if appropriate
   if ( refresh_interval > 0 && bg.sessionInProgress ) {
      gs.eventQueueScheduled('bomgar.session.refresh', current, 
                              appliance_id, lsid, run_at);
      msg += "\nSession is in progress', refresh scheduled at " + run_at;
   } else {
      msg += "\nSession is complete";
   }

   // Say we've done it
   bg.log.logInfo(msg);
   
}
