request_bomgar_session();

function request_bomgar_session() {
   
   var hostname = gs.getProperty( 'tu.bomgar.hostname', null );
   if ( !hostname ) {
	  gs.addErrorMessage('Default Bomgar Appliance was not found');
	  return;
   }
   var usr = gs.getUser();
   var company = '' + usr.getCompanyRecord();
   
   var url = 'https://' + hostname + '/api/start_session.ns?issue_menu=1';
   url += '&c2cjs=1';
   url += '&external_key=' + current.number;
   url += '&customer_name=' + escape( '' + usr.getDisplayName() );
   if ( company ) {
	  url += '&customer_company=' + escape( company.name );
   }

   gs.log("Bomgar Session Request\n[" + url + "]");
   
   var msg = gs.getUserDisplayName() + ' has issued a request for a Bomgar session';
   current.comments = msg;
   current.update();
   
   action.setRedirectURL( url );

}
