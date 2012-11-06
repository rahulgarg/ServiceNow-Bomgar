get_session_data( event.parm1, event.parm2 );

function get_session_data( appliance_id, lsid ) {
   
   var bg, msg = "Bomgar Session Starts";
   msg += "\nAppliance ID : [" + appliance_id + "]";
   msg += "\nLSID : [" + lsid + "]";
   
   // Initialise the API
   try {
      bg = new BomgarAPI( appliance_id );
   } catch(e) {
      msg += "\nFailed to initialise Bomgar API\n" + e.name + "\n" + e.message;
      gs.logError(msg,'Bomgar Event');
      return null;
   }
   
   // Get the session data
   var session = bg.retrieveSession(lsid);
   if (!session) {
      msg += "\nFailed to obtain details of session";
      msg += "\n" + bg.getErrorMessage();
      gs.logError(msg,'Bomgar Event');
      return null;
   }
   
   // Update the Bomgar Session record
   if ( !bg.saveSession(session) ) {
      msg += "\nFailed to save details of session [" + bg.getSessionName() + "]";
      msg += "\n" + bg.getErrorMessage();
      gs.logError(msg,'Bomgar Event');
      return null;
   }
   
   // Say we've done it
   msg += "\nSession saved : [" + bg.getSessionName() + "]";
   gs.log(msg,'Bomgar Event');
   
}
