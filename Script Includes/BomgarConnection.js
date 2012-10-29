gs.include("PrototypeServer");
// gs.include("tu.debug");

var BomgarConnection = Class.create();

/**
 * BomgarConnection
 */
BomgarConnection.prototype = {
   
   initialize: function(gr_appliance) {
      
      this.log = new GSLog('tu.bomgar.loglevel','Bomgar');
      /*
      this.hostname = gs.getProperty( 'tu.bomgar.hostname', 'Undefined hostname property' );
      this.username = gs.getProperty( 'tu.bomgar.username', 'Undefined username property' );
      this.password = gs.getProperty( 'tu.bomgar.password', 'Undefined password property' );
       */
      this.hostname = gr_appliance.u_hostname;
      this.username = gr_appliance.u_api_username;
      this.password = gr_appliance.u_api_password;
      
      var base_url = "https://" + this.hostname + "/api/";
      this.command_url = base_url + "command.ns";
      this.client_url  = base_url + "client_script.ns";
      this.session_url = base_url + "start_session.ns";
      this.report_url  = base_url + "reporting.ns";
      this.backup_url  = base_url + "backup.ns";
      
      this.apiParams = null;
      this.httpStatus = null;
      this.responseDoc = ''; // a string of the response
      this.postMethod = null;
      this.errorMessage = '';
      this.requestHeaders = {};
      
   },
   
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
   
   /**
    * Post the request to the Bomgar appliance
    * Returns a JS object representation of the XML response
    */
   _postRequest: function() {
      
      var i, msg = "Post Request";
      
      this.httpStatus = null;
      this.errorMessage = null;
      this.responseDoc = null;
      this.postParams = '';
      this.postResult = '';
      
      // must initialize first, to get extended protocols and SSL context
      // before making a new PostMethod
      var httpClient = new Packages.com.glide.communications.HTTPClient();
      
      // Set connection and socket timeouts to 10 secs
      var httpParams = httpClient.getParams();
      httpParams.setConnectionTimeout(10000);
      httpParams.setSoTimeout(10000);
      
      try {
         
         var pm = new Packages.org.apache.commons.httpclient.methods.PostMethod( this.request_url );
         msg += "\nRequest URL: ["+this.request_url+"]";
         this.postMethod = pm;
         
         // Add credentials to all POSTs
         var Encrypter = new Packages.com.glide.util.Encrypter();
         var clearpwd = Encrypter.decrypt(this.password);
         pm.addParameter("username", this.username);
         pm.addParameter("password", clearpwd);
         
         //		 this.postParams += "\nParam: [username] = ["+this.username+"]";
         //		 this.postParams += "\nParam: [password] = ["+clearpwd+"]";
         
         // Add action specific params
         for ( i=0; i < this.apiParams.length; i++ ) {
            pm.addParameter( this.apiParams[i][0], this.apiParams[i][1] );
            this.postParams += "\nParam: ["+this.apiParams[i][0]+"] = ["+this.apiParams[i][1]+"]";
         }
         
         msg += this.postParams;
         msg += '\n----------------------------------------';
         
         var result = httpClient.executeMethod( pm );
         
         /*
         msg = tu.debug.ExpressionDump( result, 'HTTP Result', true );
         this.log.logInfo( msg );
         
         var rh = pm.getResponseHeaders();
         msg = "HTTP Response headers (" + rh.length + ")";
         msg += "\n" + pm.getStatusLine();
         for ( i=0; i<rh.length; i++ ) {
            msg += "\n" + rh[i].getName() + " : " + rh[i].getValue();
         }
         this.log.logInfo( msg );
          */
         
         this.httpStatus = result;
         this.errorMessage = httpClient.getErrorMessage();
         this.responseDoc = "" + pm.getResponseBodyAsString();
         
         this.postResult = "\nHTTP Status:   ["+this.httpStatus+"]";
         this.postResult += "\nError Message: ["+this.errorMessage+"]";
         this.postResult += "\nResponse Doc Length:  ["+this.responseDoc.length+"]";
         
         msg += "\nPost Response" + this.postResult;
         if ( this.log.debugOn() ) {
            msg += "\nResponse Doc:  ["+this.responseDoc+"]";
         }
         this.log.logInfo(msg);
         
         pm.releaseConnection();
         
         if ( this.httpStatus != 200 ) {
            return null;
         }
         
      } catch (e) {
         
         this.errorMessage = e.toString();
         
         msg = "Failed to communicate with Bomgar appliance";
         msg += "\nError: " + this.errorMessage;
         msg += "\nRequest URL: " + this.request_url;
         msg += this.postParams;
         
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
      
      // Get the name of the XMl root element
      // (this is lost during the standard XMLHelper toObject call)
      this.responseRoot = this._getRootName();
      
      // Convert the response to a JS object
      this.responseObj = new XMLHelper(this.responseDoc).toObject();
      
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
      } catch(e) {
         return null;
      }
      
   },
   
   /**
    * get the response string
    */
   getResponseDoc: function() {
      return this.responseDoc;
   },
   
   getRequestURL: function() {
      return this.request_url;
   },
   
   getResponseHeaderValue: function(headerName) {
      var header = this.postMethod.getResponseHeader(headerName);
      return header.getValue();
   },
   
   setRequestHeader: function(headerName, headerValue) {
      this.requestHeaders[headerName]=headerValue;
   },
   
   /**
    * get the HTTP status of the post
    */
   getHttpStatus: function() {
      return this.httpStatus;
   },
   
   /**
    * get the error message as a result of the post
    */
   getErrorMessage: function() {
      return this.errorMessage;
   },
   
   /**
    * encode basic auth credentials, to be used when invoking SOAP
    * through the ECC queue
    */
   encodeCredentials: function() {
      if (this.userName == null)
         return "";
      
      var str = this.userName + ":" + this.password;
      var e = new Packages.com.glide.util.Encrypter();
      return e.encrypt(str);
   },
   
   type : 'BomgarConnection'
   
};
