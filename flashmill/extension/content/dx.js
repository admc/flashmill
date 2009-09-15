// ***** BEGIN LICENSE BLOCK *****
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
// The Original Code is Mozilla Corporation Code.
// 
// The Initial Developer of the Original Code is
// Adam Christian.
// Portions created by the Initial Developer are Copyright (C) 2008
// the Initial Developer. All Rights Reserved.
// 
// Contributor(s):
//  Adam Christian <adam.christian@gmail.com>
//  Mikeal Rogers <mikeal.rogers@gmail.com>
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

var inspection = {}; Components.utils.import('resource://flashmill/modules/inspection.js', inspection);
var utils = {}; Components.utils.import('resource://flashmill/modules/utils.js', utils);

var DomInspectorConnector = function() {
  this.lastEvent = null;
  this.lastTime = null;
  this.on = false;
};

DomInspectorConnector.prototype.grab = function(){
  var disp = $('dxDisplay').textContent;
  var dispArr = disp.split(': ');
  $('editorInput').value += 'new elementslib.'+dispArr[0].toUpperCase()+"('"+dispArr[1]+"')\n";
};  

DomInspectorConnector.prototype.changeClick = function(e) {
  if (this.on){
    this.dxOff()
    this.dxOn();
  }
  else { this.dxOff(); }
};

DomInspectorConnector.prototype.evtDispatch = function(e) {
  
  //Fix the scroll bar exception Bug 472124
  try {
    var i = inspection.inspectElement(e);  
  } catch(err){ return; }
  //var dxC = i.controllerText;
  //var dxV = String(i.validation);

  //document.getElementById('dxController').innerHTML = dxC;
  //document.getElementById('dxValidation').innerHTML = dxV;
  //alert(JSON.stringify(i));
  document.getElementById('swf').innerHTML = i.elementText;
  window.testMovie = e.target;
  
  return i.elementText;
}
DomInspectorConnector.prototype.dxToggle = function(){
  if (this.on){
    this.dxOff();
  }
  else { this.dxOn(); }
}
//Turn on the recorder
//Since the click event does things like firing twice when a double click goes also
//and can be obnoxious im enabling it to be turned off and on with a toggle check box
DomInspectorConnector.prototype.dxOn = function() {
  this.on = true;
 
  var enumerator = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                     .getService(Components.interfaces.nsIWindowMediator)
                     .getEnumerator("navigator:browser");
  while(enumerator.hasMoreElements()) {
    var win = enumerator.getNext();
      this.dxRecursiveBind(win.content, 'dblclick');
      win.content.focus();
  }
  var observerService =
    Components.classes["@mozilla.org/observer-service;1"]
      .getService(Components.interfaces.nsIObserverService);

  observerService.addObserver(this.observer, "toplevel-window-ready", false);
};

//when a new dom window gets opened
DomInspectorConnector.prototype.observer = {
  observe: function(subject,topic,data){
    //Attach listener to new window here
    MozMilldx.dxRecursiveBind(subject, 'dblclick');
  }
};

//when a new dom window gets opened
DomInspectorConnector.prototype.observer = {
  observe: function(subject,topic,data){
      subject.addEventListener("DOMContentLoaded", function(event) {
        
        //try attaching a listener to the dom content for load and beforeunload
        //so that we can properly set the documentLoaded flag
        try {
          subject.content.addEventListener("load", function(event) {
            MozMilldx.dxRecursiveBind(subject.content, 'dblclick');
          }, false);
          subject.content.addEventListener("beforeunload", function(event) {
            MozMilldx.dxRecursiveUnBind(subject.content, 'dblclick');
          }, false);
        } catch(err){}

      }, false);  
  }
};

DomInspectorConnector.prototype.dxOff = function() {
  this.on = false;

  //try to cleanup left over outlines
  if (this.lastEvent){
    this.lastEvent.target.style.outline = "";
  }
  
  var enumerator = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                     .getService(Components.interfaces.nsIWindowMediator)
                     .getEnumerator("navigator:browser");
  
  while(enumerator.hasMoreElements()) {
    var win = enumerator.getNext();
    this.dxRecursiveUnBind(win.content, 'dblclick');
  }

  var observerService =
    Components.classes["@mozilla.org/observer-service;1"]
      .getService(Components.interfaces.nsIObserverService);

  try { 
    observerService.removeObserver(this.observer, "toplevel-window-ready");
  } catch(err){}
};

DomInspectorConnector.prototype.getFoc = function(e){
  var lowerTag = e.target.tagName.toLowerCase();
  
  if ((lowerTag != "embed") && (lowerTag != "object")){
    alert('This does not appear to be a flash embed or object');
    document.getElementById('swf').innerHTML = "";  
    window.testMovie = null;
  }
  
  MozMilldx.dxToggle();
  e.target.style.outline = "";
  e.stopPropagation();
  e.preventDefault();
  window.focus();
}

//Recursively bind to all the iframes and frames within
DomInspectorConnector.prototype.dxRecursiveBind = function(frame, clickMethod) {
  
  frame.addEventListener('mouseover', this.evtDispatch, true);
  frame.addEventListener('mouseout', this.evtDispatch, true);
  frame.addEventListener('dblclick', this.getFoc, true);
  
  var iframeCount = frame.window.frames.length;
  var iframeArray = frame.window.frames;

  for (var i = 0; i < iframeCount; i++){
      try {
        iframeArray[i].addEventListener('mouseover', this.evtDispatch, true);
        iframeArray[i].addEventListener('mouseout', this.evtDispatch, true);
        iframeArray[i].addEventListener('dblclick', this.getFoc, true);

        this.dxRecursiveBind(iframeArray[i], 'dblclick');
      } catch(error) {}
  }
};

//Recursively bind to all the iframes and frames within
DomInspectorConnector.prototype.dxRecursiveUnBind = function(frame, clickMethod) {
  frame.removeEventListener('mouseover', this.evtDispatch, true);
  frame.removeEventListener('mouseout', this.evtDispatch, true);
  frame.removeEventListener('dblclick', this.getFoc, true);
  
  var iframeCount = frame.window.frames.length;
  var iframeArray = frame.window.frames;

  for (var i = 0; i < iframeCount; i++){
      try {
        iframeArray[i].removeEventListener('mouseover', this.evtDispatch, true);
        iframeArray[i].removeEventListener('mouseout', this.evtDispatch, true);
        iframeArray[i].removeEventListener('dblclick', this.getFoc, true);

        this.dxRecursiveUnBind(iframeArray[i], 'dblclick');
      } catch(error) {}
  }
};

var MozMilldx = new DomInspectorConnector();

// Scoping bug workarounds
var enableDX = function () {
  MozMilldx.dxOn();
}
var disableDX = function () {
  MozMilldx.dxOff();
}