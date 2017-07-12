const fs = require('fs');
const path = require('path');

exports.onWindow = win => {
  win.rpc.on('EXECUTE_NPM_SCRIPT', ({ script, session }) => {
    win.sessions.get(session).write(script + '\r');
  });
};

exports.decorateHyperToolbar = (HyperToolbar, { React }) => {
  class HyperToolbarNpmScripts extends React.Component {
    constructor (props) {
      super(props);
      this.onSelectScript = this.onSelectScript.bind(this);
    }

    onSelectScript (e) {
      const script = e.target.value;
      this.props.onExecuteScript(script);
    }

    render () {
      const options = Object.keys(this.props.scripts || {})
        .map(script => React.createElement('option', { value: this.props.scripts[script] }, script));
      
      return React.createElement(
        'div', 
        { className: 'npm-scripts-container' }, 
        options.length ? React.createElement('select', { onChange: this.onSelectScript }, ...options) : null
      );
    }
  }

  return class extends React.Component {
    constructor (props) {
      super(props);

      this.onExecuteScript = this.onExecuteScript.bind(this);
    }
    
    onExecuteScript (script) {
      window.rpc.emit('EXECUTE_NPM_SCRIPT', { session: this.props.state.npm.sessionId, script });
    }

    render() {
      this.props.plugins = (this.props.plugins || [])
        .concat(React.createElement(
          HyperToolbarNpmScripts, 
          { 
            scripts: this.props.state.npm.scripts,
            onExecuteScript: this.onExecuteScript 
          }
        ));
      return React.createElement(HyperToolbar, this.props);
    }
  }
}

exports.reduceSessions = (state, action) => {
  switch (action.type) {
    case 'SET_NPM_SCRIPTS':
      return state.setIn(['sessions', state.activeUid, 'scripts'], action.payload);
    default:
      return state;
  }
};

exports.mapHyperState = (state, map) => {
  const scripts = state.sessions.sessions[state.sessions.activeUid] ? 
    state.sessions.sessions[state.sessions.activeUid].scripts : null;
  
  const sessionId = state.sessions.activeUid;

  if (map.toolbar) {
    map.toolbar.state.npm = { scripts, sessionId };
  }

  return Object.assign({}, map);
};

exports.middleware = (store) => (next) => (action) => {
  if (action.type === 'SESSION_SET_CWD') {
    const potentialPackageJsonDir = `${action.cwd}${path.sep}package.json`;

    fs.access(potentialPackageJsonDir, (err) => {
      if (err) {
        store.dispatch({
          type: 'SET_NPM_SCRIPTS',
          payload: {}
        });
      } else {
        fs.readFile(potentialPackageJsonDir, 'utf-8', (err, data) => {
          if (err) {
            console.log(err);
          } else {
            const packageJson = JSON.parse(data);

            store.dispatch({
              type: 'SET_NPM_SCRIPTS',
              payload: packageJson.scripts ? packageJson.scripts : {}
            });
          }
        });
      }
    });
  }

  next(action);
};
