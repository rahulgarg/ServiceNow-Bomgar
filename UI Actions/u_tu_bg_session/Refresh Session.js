refresh_session_data();

function refresh_session_data() {
   bg = new BomgarAPI( current.u_appliance.u_hostname );
   ss = bg.retrieveSession( current.u_lsid );
   if (!ss) {
      gs.addErrorMessage( bg.getErrorMessage() );
   }
   if ( !bg.saveSession(ss) ) {
      gs.addErrorMessage( bg.getErrorMessage() );
   } else {
      gs.addInfoMessage( "Session refreshed successfully" );
   }
   action.setRedirectURL( current );
}
