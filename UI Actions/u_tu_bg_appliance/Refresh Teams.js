refresh_team_data();

function refresh_team_data() {
   var bg = new BomgarAPI(current.u_appliance_id);
   var st = bg.retrieveSupportTeams(true);
   if (!st) {
	  gs.addErrorMessage( bg.getErrorMessage() );
	  return;
   }
   if ( !bg.saveSupportTeams(st) ) {
	  gs.addErrorMessage( bg.getErrorMessage() );
	  return;
   }

   gs.addInfoMessage( "Teams refreshed successfully" );
   
   action.setRedirectURL( current );
}
