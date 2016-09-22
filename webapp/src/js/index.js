import _debounce from 'lodash/debounce';
import createHistory from 'history/createBrowserHistory';
const history = createHistory();

//Needed for JSX
import React from 'react'; //eslint-disable-line no-unused-vars
import ReactDOM from 'react-dom';

import Fluxxor from 'fluxxor';
import Immutable from 'immutable';
import Panoptes from 'components/Panoptes.js';
import Loading from 'components/ui/Loading.js';

import SessionStore from 'stores/SessionStore';
import PanoptesStore from 'stores/PanoptesStore';
import ConfigStore from 'stores/ConfigStore';

import SessionActions from 'actions/SessionActions';
import PanoptesActions from 'actions/PanoptesActions';
import APIActions from 'actions/APIActions';

import API from 'panoptes/API';

import InitialConfig from 'panoptes/InitialConfig';
import injectTapEventPlugin from 'react-tap-event-plugin';

import Perf from 'react-addons-perf';

if (process.env.NODE_ENV !== 'production') { //eslint-disable-line no-undef
  window.Perf = Perf;
}

import 'console-polyfill';
import 'normalize.css';

//Needed for onTouchTap
//Can go away when react 1.0 release
//Check this repo:
//https://github.com/zilverline/react-tap-event-plugin
injectTapEventPlugin();

//Throw up a loader till we are ready
ReactDOM.render(<div><Loading status="loading-hide"/></div>, document.getElementById('main'));

initialConfig.serverURL = process.env.NODE_ENV === 'production' ? '/api' : '//' + window.location.hostname + ':8000/api'; //eslint-disable-line no-undef

function getAppState(location) {
  let match = /\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.exec(location);
  let defaultState = {
    session: {
      components: {
        FirstTab: {
          type: 'StartTab',
          props: {}
        }
      },
      tabs: {
        components: ['FirstTab'],
        selectedTab: 'FirstTab',
        unclosableTab: 'FirstTab'
      },
      popups: {
        components: [],
        state: {}
      },
      modal: {},
      foundGenes: [],
      usedTableQueries: []
    }
  };

  if (match)
    return API.fetchData(match[0]).then((appState) => appState || defaultState
    );
  else
    return defaultState;
}

Promise.prototype.done = function(onFulfilled, onRejected) {
  this.then(onFulfilled, onRejected)
    .catch((e) => {
      setTimeout(() => {
        console.log(e.stack);
        throw e;
      });
    })
  ;
};

Promise.all([InitialConfig(initialConfig.dataset), getAppState(window.location)]) //eslint-disable-line no-undef
  .then((values) => {
    let [config, appState] = values;
    let stores = {
      PanoptesStore: new PanoptesStore({
        storedSubsets: {}
      }),
      SessionStore: new SessionStore(appState.session),
      ConfigStore: new ConfigStore(config)
    };

    //Listen to the stores and update the URL after storing the state, when it changes.
    let getState = () => {
      let state = Immutable.Map();
      //Clear the modal as we don't want that to be stored
      state = state.set('session', stores.SessionStore.getState().set('modal', Immutable.Map()));
      return state;
    };
    let lastState = getState();
    //Store if state change was due to backbutton - if it was then don't store it again.
    let backbutton = null;
    let storeState = () => {
      if (backbutton) {
        backbutton = false;
        return;
      }
      backbutton = false;
      let newState = getState();
      if (!lastState.equals(newState)) {
        lastState = newState;
        API.storeData(newState.toJS()).then((resp) => {
          history.push(`/${resp}`, newState.toJS());
        });
      }

    };
    storeState = _debounce(storeState, 250);
    stores.SessionStore.on('change', storeState);

    history.listen((location, action) => {
      if (action === 'POP') {
        let newState = Immutable.fromJS((location.state ? location.state.session : null) || getAppState(location.pathname).session);
        if (!newState.equals(stores.SessionStore.state)) {
          stores.SessionStore.state = newState;
          backbutton = true;
          stores.SessionStore.emit('change');
        }
      }
    });

    let actions = {
      session: SessionActions,
      panoptes: PanoptesActions(config),
      api: APIActions
    };

    let flux = new Fluxxor.Flux(stores, actions);

    flux.setDispatchInterceptor((action, dispatch) =>
      ReactDOM.unstable_batchedUpdates(() =>
        dispatch(action)
      )
    );

    ReactDOM.render(
      <div>
        <Loading status="done"/>
        <Panoptes flux={flux} />
      </div>
      , document.getElementById('main'));
  })
  .done();
