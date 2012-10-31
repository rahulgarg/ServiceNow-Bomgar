gs.include("PrototypeServer");
// gs.include("tu.debug");

var BomgarConnection = Class.create();

/**
 * BomgarConnection
 */
BomgarConnection.prototype = {
   
   initialize: function(gr_appliance) {
      
      this.log = new GSLog('tu.bomgar.loglevel.conn','Bomgar');

      if ( !gr_appliance || !gr_appliance.u_hostname ) {
         throw {
            'name': 'Invalid Bomgar Appliance',
            'message': 'Supplied appliance: [' + gr_appliance.toString() + ']'
         };
      }

      this.hostname = gr_appliance.u_hostname;
      this.username = gr_appliance.u_api_username;
      this.password = gr_appliance.u_api_password;
      
      var base_url = "https://" + this.hostname + "/api/";
      this.command_url = base_url + "command.ns";
      this.client_url  = base_url + "client_script.ns";
      this.session_url = base_url + "start_session.ns";
      this.report_url  = base_url + "reporting.ns";
      this.backup_url  = base_url + "backup.ns";

      this.connectTimeout = gs.getProperty( 'tu.bomgar.connect.timeout', 10 ) * 1000;
      this.socketTimeout = gs.getProperty( 'tu.bomgar.socket.timeout', 10 ) * 1000;
      
      this.apiParams = null;
      this.httpStatus = null;
      this.responseDoc = ''; // a string of the response
      this.responseObj = null; // a JavaScript object from the XML response
      this.postMethod = null;
      this.errorMessage = '';
      
   },
   
   //---------------------------------------------
   // Public method definitions
   //---------------------------------------------

   sendCommand: function( params ) {
      this.request_url = this.command_url;
      this.apiParams = params;
      return this._postRequest();
   },
   
   getReport: function( params ) {
      this.request_url = this.report_url;
      this.apiParams = params;
      return this._postRequest();
   },
   
   startSession: function( params ) {
      this.request_url = this.session_url;
      this.apiParams = params;
      return this._postRequest();
   },

   //---------------------------------------------
   
   getRequestURL: function() {
      return this.request_url;
   },
   
   getHttpStatus: function() {
      return this.httpStatus;
   },
   
   getResponseDoc: function() {
      return this.responseDoc;
   },
   
   getResponseObject: function() {
      return this.responseObj;
   },
   
   getResponseRootName: function() {
      return this.responseRoot;
   },
   
   getErrorMessage: function() {
      return this.errorMessage;
   },
   
   //---------------------------------------------
   // Internal method definitions
   //---------------------------------------------

   /**
    * Post the request to the Bomgar appliance
    * Returns a JS object representation of the XML response
    */
   _postRequest: function() {
      
      var i, msg = "Post Request";
      var msg_sep = '\n----------------------------------------\n';

      msg += "\nRequest URL: [" + this.request_url + "]";
      msg += "\nTimeouts: [" + this.connectTimeout + "],[" + this.socketTimeout + "]";
      
      this.httpStatus = null;
      this.errorMessage = null;
      this.responseDoc = null;
      this.responseObj = null;
      this.responseRoot = null;
      this.postParams = '';
      this.postResult = '';
      
      try {

         // must initialize first, to get extended protocols and SSL context
         // before making a new PostMethod
         var httpClient = new Packages.com.glide.communications.HTTPClient();
         
         // Set connection and socket timeouts
         var httpParams = httpClient.getParams();
         httpParams.setConnectionTimeout( this.connectTimeout );
         httpParams.setSoTimeout( this.socketTimeout );
         
         var pm = new Packages.org.apache.commons.httpclient.methods.PostMethod( this.request_url );
         this.postMethod = pm;
         
         // Add credentials to all POSTs
         var Encrypter = new Packages.com.glide.util.Encrypter();
         var clearpwd = Encrypter.decrypt(this.password);
         pm.addParameter("username", this.username);
         pm.addParameter("password", clearpwd);
         
         //     this.postParams += "\nParam: [username] = ["+this.username+"]";
         //     this.postParams += "\nParam: [password] = ["+clearpwd+"]";
         
         // Add action specific params
         for ( i=0; i < this.apiParams.length; i++ ) {
            pm.addParameter( this.apiParams[i][0], this.apiParams[i][1] );
            this.postParams += "\nParam: ["+this.apiParams[i][0]+"] = ["+this.apiParams[i][1]+"]";
         }

         msg += this.postParams + msg_sep;

         //-------------------------------------------------
         // Make the HTTP Request to the Bomgar Appliance
         //-------------------------------------------------
         var result = httpClient.executeMethod( pm );
         
         this.httpStatus = result;
         this.errorMessage = httpClient.getErrorMessage();
         this.responseDoc = '' + pm.getResponseBodyAsString();
         
      } catch (http_exception) {

         this.errorMessage = '' + http_exception.toString();
         msg = "ERROR: " + this.errorMessage + msg_sep + msg;
         if ( this.log.debugOn() ) {
            var sb = new Packages.java.lang.StringBuffer();
            var st = e.getStackTrace();
            for ( i = 0; i < st.length; i++) {
               sb.append(st[i].toString() + "\n");
            }
            msg += "\n" + sb.toString();
         }
         this.log.logError(msg);
         return null;

      } finally {
         this.postMethod.releaseConnection();
      }


      this.postResult = "\nHTTP Status:   ["+this.httpStatus+"]";
      this.postResult += "\nError Message: ["+this.errorMessage+"]";
      this.postResult += "\nResponse Doc Length:  ["+this.responseDoc.length+"]";
      
      msg += "\nPost Response" + this.postResult;
      if ( this.log.debugOn() ) {
         msg += "\nResponse Doc:  ["+this.responseDoc+"]";
      }
      
      if ( this.httpStatus != 200 ) {
         this.errorMessage = "Received unexpected HTTP Status (" + 
                              this.httpStatus + ") from Bomgar appliance";
         msg = "ERROR: " + this.errorMessage + "\n" + msg + msg_sep;
         this.log.logError(msg);
         return null;
      }
      
      this.log.logInfo(msg);
      
      // Get the name of the XMl root element
      // (this is lost during the standard XMLHelper toObject call)
      this.responseRoot = this._getRootName();
      
      // Convert the response to a JS object
      try {
         this.responseObj = new XMLHelper(this.responseDoc).toObject();
      } catch (xml_exception) {
         this.errorMessage = "Failed to convert Bomgar XML to JavaScript object";
         this.errorMessage += '\n' + xml_exception.toString();
         msg = "ERROR: " + this.errorMessage + msg_sep + msg;
         this.log.logError(msg);
         return null;
      }
      
      return this.responseObj;
      
   },
   
   // Get the name of the XML root element
   _getRootName: function () {
      
      // Search for root element with or without XML Declaration
      var parse_xml = /^(?:<\?xml.*\?>)?\s*<(\w+)[\s>]/;
      var res;
      
      try {
         res = parse_xml.exec( this.responseDoc );
         if ( res.length >= 2 ) {
            return res[1];
         }
      } catch(regex_exception) {
         return null;
      }
      
   },
   
   type : 'BomgarConnection'
   
};
