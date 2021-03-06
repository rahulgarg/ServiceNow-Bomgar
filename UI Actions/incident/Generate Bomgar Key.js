generate_session_key();

function generate_session_key() {
   var bg = new BomgarAPI();
   var sk = bg.generateSessionKey(current.number);

   if ( !sk ) {
     gs.addErrorMessage( 'Failed to generate Bomgar Session Key' );
     return;
   }
   
   var exp = bg.getGlideDateTime(sk.expires);

   var msg = "Session Key generated:  " + sk.short_key;
   msg += "  (expires: " + exp.getDisplayValue() + ")";

   gs.addInfoMessage(msg);

   msg += "\nAlternative URL:   " + sk.key_url;

   current.work_notes = msg;

   var keygen_email = gs.getProperty( 'tu.bomgar.keygen.email', 'none' );

   if ( keygen_email == 'custom' ) {
      // Send the event to trigger a custom email
      gs.eventQueue("bomgar.session.keygen", current, sk.short_key, sk.key_url);
   } else if ( keygen_email == 'comment' ) {
      // Add a customer visible comment (which may trigger an email)
      msg = "The support engineer, " + current.assigned_to.getDisplayValue();
      msg += ", would like to establish a remote support session to your device ";
      msg += "in order to progress incident number, " + current.number + ". ";
      msg += "\nThe assigned session key is : " + sk.short_key;
      msg += "\nTo assist them in establishing this support session, please follow the link below.\n\n";
      msg += sk.mail_body;
      current.comments = msg;
   }

   action.setRedirectURL(current);
   current.update();
   
}
