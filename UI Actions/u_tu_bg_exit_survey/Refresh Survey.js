refresh_session_data();

function refresh_session_data() {
   var appliance_id = current.u_session.u_appliance.u_appliance_id.toString();
   var lsid = current.u_session.u_lsid.toString();
   var bg, msg = "Bomgar Survey Refresh";
   try {
	  bg = new BomgarAPI(appliance_id);
   } catch(e) {
	  return;
   }
	  
   var survey = bg.retrieveExitSurvey(lsid,current.u_survey_type.toString());
   if (survey) {
	  bg.saveExitSurvey(survey);
	  gs.addInfoMessage( "Survey refreshed successfully" );
   } else {
	  gs.addErrorMessage( bg.getErrorMessage() );
   }

   action.setRedirectURL( current );

}
