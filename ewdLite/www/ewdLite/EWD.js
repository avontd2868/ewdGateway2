var EWD = {
  trace: false,
  initialised: false,
  sockets: {
    log: false,
    handlerFunction: {},
    sendMessage: function(params) {
      if (typeof params.message === 'undefined') params.message = '';
      params.token = EWD.sockets.token;
      params.handlerModule = EWD.application.name;
      params.lite = true;
      if (typeof console !== 'undefined') {
        if (EWD.sockets.log) console.log("sendMessage: " + JSON.stringify(params));
      }
      this.socket.json.send(JSON.stringify(params));
    },

    keepAlive: function(mins) {
      EWD.sockets.timeout = mins;
      setTimeout(function() {
        EWD.sockets.sendMessage({type: "keepAlive", message:  "1"});
        EWD.sockets.keepAlive(EWD.sockets.timeout);
      },EWD.sockets.timeout*60000);
    },

    submitForm: function(params) {
      var framework = params.framework || 'extjs';
      var payload = params.fields;
      if (framework === 'extjs') {
        payload = Ext.getCmp(params.id).getValues();
      }
      if (params.alertTitle) payload.alertTitle = params.alertTitle;
      payload.js_framework = framework;
      EWD.sockets.sendMessage({
        type: params.messageType, 
        params: payload
      });
    },

    startSession: function(messageFunction) {
      if (typeof messageFunction === 'undefined') messageFunction = EWD.sockets.serverMessageHandler;
      this.socket = io.connect();
      this.socket.on('connect', function() {
        if (typeof EWD.sockets.token !== 'undefined') {
          EWD.sockets.sendMessage({type: 'EWD.startSession'});
        }
      });
      this.socket.on('message', function(obj){
        //console.log("onMessage: " + JSON.stringify(obj));
        if (EWD.application) {
          if (obj.type === 'EWD.connected') {
             EWD.sockets.sendMessage({type: 'EWD.register', application: EWD.application});
             return;
          }
        }
        else {
          console.log('Unable to register application: EWD.application has not been defined');
          return;
        }

        if (obj.type === 'EWD.registered') {
          EWD.sockets.token = obj.token;
          EWD.initialised = true;
          document.getElementsByTagName('body')[0].dispatchEvent(EWD.socketsReadyEvent);
          return;
        }

        if (obj.message) {
          var payloadType = obj.message.payloadType;
          if (payloadType === 'innerHTMLReplace') {
            var replacements = obj.message.replacements;
            var replacement;
            var prefix;
            for (var i = 0; i < replacements.length; i++) {
              replacement = replacements[i];
              prefix = replacement.prefix || '';
              for (var idName in replacement.ids) {
                document.getElementById(prefix + idName).innerHTML = replacement.ids[idName];
              }
            }
          }
          if (payloadType === 'bootstrap') {
            var action = obj.message.action;
            if (action === 'replaceTables') {
              var tables = obj.message.tables;
              var tableNo;
              var table;
              var i;
              var html;
              var tableTag;
              var columns;
              var colNo;
              var row;
              for (tableNo = 0; tableNo < tables.length; tableNo++) {
                table = tables[tableNo];
                tableTag = document.getElementById(table.id);
                html = '<thead><tr>'
                columns = EWD.bootstrap.table[table.id].columns;
                for (i = 0; i < columns.length; i++) {
                  if (columns[i].heading !== '') html = html + '<th>' + columns[i].heading + '</th>'; 
                }
                html = html + '</tr></thead>';
                html = html + '<tbody>';
                for (i = 0; i < table.content.length; i++) {
                  row = table.content[i];
                  html = html + '<tr>';
                  for (colNo = 0; colNo < columns.length; colNo++) {
                    html = html + '<td>' + row[columns[colNo].id] + '</td>';
                  }
                  html = html + '</tr>';
                }
                 html = html + '</tbody>';
                 tableTag.innerHTML = html;
              }
            }
          }
        }

        if (obj.type.indexOf('EWD.form.') !== -1) {
          if (obj.error) {
            var alertTitle = 'Form Error';
            if (obj.alertTitle) alertTitle = obj.alertTitle;
            if (obj.js_framework === 'extjs') {
              Ext.Msg.alert(alertTitle, obj.error);
            }
            else {
              alert(obj.error);
            }
            return;
          }
        }

        if (obj.type.indexOf('EWD.error') !== -1) {
          if (obj.error) {
            if (EWD.trace) console.log(obj.error);
          }
          return;
        }

        if (obj.type.indexOf('EWD.inject') !== -1) {
          if (obj.js) {
            if (EWD.trace) console.log(obj.js);
            try {
              eval(obj.js);
              if (obj.fn) eval(obj.fn);
            }
            catch(error) {
              if (EWD.trace) {
                console.log('EWD.inject failed:');
                console.log(error);
              }
            }
          }
          return;
        }

        if (typeof EWD.token !== 'undefined' && typeof EWD.sockets.handlerFunction[obj.type] !== 'undefined') {
          EWD.sockets.handlerFunction[obj.type](obj);
          obj = null;
          return;
        }

	 if (EWD.onSocketMessage) {
          EWD.onSocketMessage(obj);
          obj = null;
          return;
        }
      });
    }
  },
  readyEvent: new CustomEvent('ready',{
    detail: {
      message: 'EWD Initialised'
    }
  }),
  socketsReadyEvent: new CustomEvent('socketsReady',{
    detail: {
      message: 'Sockets Initialised'
    }
  }),
  ready: false,
  isReady: function() {
    if (!EWD.ready) {
      var body = document.getElementsByTagName('body')[0];
      body.addEventListener('ready', function(e) {
        EWD.sockets.startSession();
      });
      body.addEventListener('socketsReady', function(e) {
        if (EWD.onSocketsReady) EWD.onSocketsReady();
      });
      body.dispatchEvent(EWD.readyEvent);
      EWD.ready = true;
    }
  }
};
