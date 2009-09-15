// ***** BEGIN LICENSE BLOCK *****// ***** BEGIN LICENSE BLOCK *****
// Version: MPL 1.1/GPL 2.0/LGPL 2.1
// 
// The contents of this file are subject to the Mozilla Public License Version
// 1.1 (the "License"); you may not use this file except in compliance with
// the License. You may obtain a copy of the License at
// http://www.mozilla.org/MPL/
// 
// Software distributed under the License is distributed on an "AS IS" basis,
// WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
// for the specific language governing rights and limitations under the
// License.
// 
// 
// The Initial Developer of the Original Code is
// Adam Christian.
// Portions created by the Initial Developer are Copyright (C) 2008
// the Initial Developer. All Rights Reserved.
// 
// Contributor(s):
//  Adam Christian <adam.christian@gmail.com>
// 
// Alternatively, the contents of this file may be used under the terms of
// either the GNU General Public License Version 2 or later (the "GPL"), or
// the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
// in which case the provisions of the GPL or the LGPL are applicable instead
// of those above. If you wish to allow use of your version of this file only
// under the terms of either the GPL or the LGPL, and not to allow others to
// use your version of this file under the terms of the MPL, indicate your
// decision by deleting the provisions above and replace them with the notice
// and other provisions required by the GPL or the LGPL. If you do not delete
// the provisions above, a recipient may use your version of this file under
// the terms of any one of the MPL, the GPL or the LGPL.
// 
// ***** END LICENSE BLOCK *****

var mozmill = {}; Components.utils.import('resource://flashmill/modules/mozmill.js', mozmill);
var controller = {}; Components.utils.import('resource://flashmill/modules/controller.js', controller);
var elementslib = {}; Components.utils.import('resource://flashmill/modules/elementslib.js', elementslib);
var httpd = {};   Components.utils.import('resource://flashmill/stdlib/httpd.js', httpd);

var prefManager = Components.classes["@mozilla.org/preferences-service;1"]
                          .getService(Components.interfaces.nsIPrefBranch);


                          
var flashmill = new function(){
  this.httpPort = 43336;
  
  this.startHttpd = function () {
    //automatically serve a crossdomain.xml at the root
    //to avoid flash cross domain security issues
    function handler(request, response){
      response.setStatusLine(request.httpVersion, 200, "OK");
      response.setHeader("Content-Type", "application/xml", false);
      var r = '';
      r += '<?xml version="1.0"?>';
      r += '<!DOCTYPE cross-domain-policy SYSTEM "http://www.adobe.com/xml/dtds/cross-domain-policy.dtd">';
      r += '<cross-domain-policy>';
      r += '<site-control permitted-cross-domain-policies="all"/>';
      r += '<allow-access-from domain="*"/>';
      r += '<allow-http-request-headers-from domain="*" headers="*"/>';
      r += '</cross-domain-policy>';
      response.write(r);
    }
    
    while (this.httpd == undefined) {
      try {
        httpServer.start(this.httpPort);
        this.httpd = httpServer;
      } catch(e) { // Failure most likely due to port conflict
        this.httpPort++;
        httpServer = httpd.getServer(this.httpPort);
        try {
          //register crosdomain.xml
          httpServer.registerPathHandler("/crossdomain.xml", handler);
        } catch(err){
          alert(err);
        }
      }; 
    }     
  };
  
  this.stopHttpd = function () {
    this.httpd.stop()
    this.httpd = null;
  };
  
  this.addHttpResource = function (directory, ns) {
    if (!this.httpd) {
      this.startHttpd();
    }
    // if (ns == undefined) {
    //   var uuidgen = Components.classes["@mozilla.org/uuid-generator;1"]
    //       .getService(Components.interfaces.nsIUUIDGenerator);
    //   var ns = uuidgen.generateUUID().toString().replace('-', '').replace('{', '').replace('}','');
    // }
    var lp = Components.classes["@mozilla.org/file/local;1"]
               .createInstance(Components.interfaces.nsILocalFile);
    lp.initWithPath(directory);
    this.httpd.registerDirectory('/', lp);
    return 'http://localhost:'+this.httpPort+'/'
  }
  
  this.recursiveSearch = function(frame){
    
    var tags = [];
    var embeds = Array.prototype.slice.call(frame.document.getElementsByTagName("embed"));
    var object = Array.prototype.slice.call(frame.document.getElementsByTagName("object"));
    tags = embeds.concat(object);
    
    for (var i=0;i<tags.length;i++){
      try {
        //check and see if the API is there for running tests
        if (tags[i].wrappedJSObject.wm_runASTests){
          window.testMovie = tags[i];
          return;
        }
      } catch(err){
        alert(err);
      }
     } 
      
      var iframeCount = frame.window.frames.length;
      var iframeArray = frame.window.frames;

      for (var i = 0; i < iframeCount; i++){
          try {
            var tags = [];
            var embeds = Array.prototype.slice.call(iframeArray[i].document.getElementsByTagName("embed"));
            var objects = Array.prototype.slice.call(iframeArray[i].document.getElementsByTagName("object"));
            tags = embeds.concat(objects);
            
            //for each embed on the page
            for (var i=0;i<tags.length;i++){
              //check and see if the API is there for running tests
              if (tags[i].wrappedJSObject.wm_runASTests){
                window.testMovie = tags[i];
                return;
              }
            }
            this.dxRecursiveBind(iframeArray[i]);
          } catch(err) { alert(err); }
      }
  };
  
  this.getMovie = function(){
    //if there hasn't been a selected embed
    //serach for one that has a windmill API open
    if (!window.testMovie){
      //if there is an elementslib lookup in the box
      if ($("#swf")[0].value != ""){
        var controller = mozmill.getBrowserController();
        var n = eval($("#swf")[0].value);
        window.testMovie = n.getNode();
      }
    }
    
    if (!window.testMovie){
      var controller = mozmill.getBrowserController();
      //try to find the embed by iterating the page
      this.recursiveSearch(controller.window.content)
    }
    
    //if we still couldnt get a test movie, bail
    if (!window.testMovie){
      alert("Please select the swf on the page you would like to test.")
      return false;
    }
    
    return true;
  };

  this.serveToFlash = function(urls){

    if (!this.getMovie()){
      return;
    }
    
    document.getElementById("output").innerHTML = "";
    document.getElementById("pass").innerHTML = "0";
    document.getElementById("fail").innerHTML = "0";
    
    var buildDiv = function(content, status){
      var entry = document.createElement('div');
      entry.style.width = "97%";
      entry.style.padding = "2px";
      
      if (status){
        $(entry).addClass("ui-state-highlight ui-corner-all");
        entry.style.background = "lightgreen";
        entry.style.border = "1px solid darkgreen";
        entry.style.color = "black";
      }
      else {
        $(entry).addClass("ui-state-error ui-corner-all");
      }
      entry.innerHTML = content;
      return entry;
    };
    
    //add a function to the window of the test movie
    window.testMovie.wrappedJSObject.ownerDocument.defaultView.wm_asTestResult = function(res){
      var out = document.getElementById("output");
      var pass = document.getElementById("pass");
      var fail = document.getElementById("fail");
      
      if (res.error){
        var str = "<b>" +res.test.className+ "</b>: " + res.test.methodName + "<br><hr style='border-style:dashed;'><b>Why</b>: " + res.error.message;
        var d = buildDiv(str, false);
        out.appendChild(d);
        fail.innerHTML = parseInt(fail.innerHTML) + 1;
      } 
      if (!res.error) {
        var str = "<b>" + res.test.className + "</b>: " + res.test.methodName;
        var d = buildDiv(str, true);
        out.appendChild(d);
        pass.innerHTML = parseInt(pass.innerHTML) + 1;
      }
      $("#output")[0].scrollTop = parseInt($("#output")[0].style.height.replace("px",""));
      
      return true;
    };
    
    $("#tabs").tabs().tabs("select", 1);
        
    //run tests
    try {
      window.testMovie.wrappedJSObject['wm_runASTests'](urls);
    } catch(err){
      alert('Could not locate the test movie embed, please select it.');
      $("#tabs").tabs().tabs("select", 0);
    }
    return true;
  };
  
  this.buildURLPaths = function(url, paths){
    var urls = [];
    for (var i=0;i<paths.length;i++){
      urls.push(url+paths[i]);
    }
    return urls;
  };
  
  this.runDir = function(){
    var nsIFilePicker = Components.interfaces.nsIFilePicker;
     var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
     fp.init(window, "Select a Directory", nsIFilePicker.modeGetFolder);
     var res = fp.show();
     //got a directory
     if (res == nsIFilePicker.returnOK){
       var url = this.addHttpResource(fp.file.path);
       
       var entries = fp.file.directoryEntries;
       var paths = [];
       
       //iterate files
       while(entries.hasMoreElements()){
         var entry = entries.getNext();
         var arg = entry.QueryInterface(Components.interfaces.nsILocalFile).leafName;
         if (arg.indexOf(".swf") != -1){
           paths.push(arg);
         }
       }
       var urls = this.buildURLPaths(url, paths);
       //send to flash
       this.serveToFlash(urls);
     } else {
       alert("There was an error selecting that directory.");
     }
  };
  
  this.runFiles = function(){
    var nsIFilePicker = Components.interfaces.nsIFilePicker;
     var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
     fp.init(window, "Select a File", nsIFilePicker.modeOpenMultiple);
     fp.appendFilter("ActionScript Tests","*.swf");
     var res = fp.show();
     if (res == nsIFilePicker.returnOK){
       var files = fp.files;
       var paths = [];
       var path = '';
       while (files.hasMoreElements()) {
         var fQ = files.getNext().QueryInterface(Components.interfaces.nsILocalFile);
         var arg = fQ.leafName;
         var path = fQ.parent.path;
          
         paths.push(arg);
       }
       var url = this.addHttpResource(path);
       var urls = this.buildURLPaths(url, paths);
       //send to flash
       this.serveToFlash(urls);
      
      } else {
       alert("There was an error selecting that file.");
     }
  };

  this.init = function(){
    flashmill.initialized = true;
    
    var syncheights = function(){
      $("#tabs")[0].style.height = window.innerHeight - 20 + "px";
      $("#output")[0].style.height = (parseInt($("#tabs")[0].style.height.replace("px","")) - 55) + "px";
      //$("#output")[0].style.height = "98%";
    };
    
    window.onresize = syncheights;
    syncheights();
  };
  
};