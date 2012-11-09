get_api_ver();

function get_api_ver() {

   var bg, ss, msg = "Get API Version";

   try {
	  bg = new BomgarAPI( current.u_application_id );
   } catch(e) {
	  msg += "\nFailed to initialise Bomgar API: " + e.name;
	  gs.addErrorMessage(msg);
	  msg += "\n" + e.message;
	  gs.logError(msg);
	  return;
   }
   
   ss = bg.retrieveApiInfo();
   if (ss) {
	  current.u_api_version = ss.api_version;
	  current.update();
	  gs.addInfoMessage( "API version refreshed successfully" );
   } else {
	  msg += "\nFailed obtain API version: " + bg.getErrorMessage();
	  gs.addErrorMessage(msg);
   }
   
   // Redisplay the form
   action.setRedirectURL(current);
}
