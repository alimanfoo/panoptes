import Constants from '../constants/Constants';
const APICONST = Constants.API;
import API from 'panoptes/API';

import ErrorReport from 'panoptes/ErrorReporter.js';

let APIActions = {
  fetchUser(dataset) {
    let userID = null;
    this.dispatch(APICONST.FETCH_USER);
    API.requestJSON({
      params: {
        datatype: 'custom',
        respmodule: 'panoptesserver',
        respid: 'serverstatus'
      }
    })
      .then((status) => {
        if ('issue' in status)
          throw Error(status.issue);
        userID = status.userid;
      })
      .then(API.requestJSON({
        params: {
          datatype: 'custom',
          respmodule: 'panoptesserver',
          respid: 'datasetinfo',
          database: dataset
        }
      })
        .then((resp) => {
          let note = {
            title: 'Schema Outdated',
            level: 'error',
            autoDismiss: 0,
            action: {
              label: 'Open admin',
              callback: function() {
                window.open('admin.html', '_blank'); // FIXME: Cannot GET /admin.html
              }
            }
          };
          if (resp.needfullreload) {
            note.message = 'A full reload is needed';
            this.flux.actions.session.notify(note);
          }
          if (resp.needconfigreload) {
            note.message = 'A config update is needed';
            this.flux.actions.session.notify(note);
          }
          this.dispatch(APICONST.FETCH_USER_SUCCESS, {
            id: userID,
            isManager: resp.manager
          });
        })
        .catch((error) => {
          this.dispatch(APICONST.FETCH_USER_FAIL);
          ErrorReport(this.flux, error.message, () => this.flux.actions.api.fetchUser(dataset));
        }))
      .catch((error) => {
        this.dispatch(APICONST.FETCH_USER_FAIL);
        ErrorReport(this.flux, error.message, () => this.flux.actions.api.fetchUser(dataset));
      });
  },

  storeTableQuery(payload) {

    let {dataset, table, query, name, workspace} = payload;

    // Store the current query in the db via the API.
    API.storeTableQuery(
      {
        dataset: dataset,
        table: table,
        query: query,
        name: name,
        workspace: workspace
      }
    )
    .then((resp) => {

      if ('issue' in resp) {
        throw Error(resp.issue);
      }

      this.dispatch(
        APICONST.STORE_TABLE_QUERY_SUCCESS,
        {
          id: resp.id,
          table: resp.tableid,
          query: resp.content,
          name: resp.name
        }
      );
    })
    .catch((error) => {
      this.dispatch(APICONST.STORE_TABLE_QUERY_FAIL);
      ErrorReport(this.flux, error.message, () => this.flux.actions.api.storeTableQuery({dataset, table, query, name, workspace}));
    });
  },

  deleteStoredTableQuery(payload) {

    let {dataset, table, id} = payload;

    // Store the current query in the db via the API.
    API.deleteStoredTableQuery(
      {
        dataset: dataset,
        id: id
      }
    )
    .then((resp) => {

      if ('issue' in resp) {
        throw Error(resp.issue);
      }

      this.dispatch(
        APICONST.DELETE_STORED_TABLE_QUERY_SUCCESS,
        {
          table: table,
          id: resp.id
        }
      );
    })
    .catch((error) => {
      this.dispatch(APICONST.DELETE_STORED_TABLE_QUERY_FAIL);
      ErrorReport(this.flux, error.message, () => this.flux.actions.api.deleteStoredTableQuery({dataset, table, id}));
    });
  },

  setDefaultTableQuery(payload) {

    let {dataset, table, query} = payload;

    // TODO: Get the query from the stored table queries.


    // Overwrite the default query in the db via the API.
    API.setDefaultTableQuery(
      {
        dataset: dataset,
        table: table,
        query: query
      }
    )
    .then((resp) => {

      if ('issue' in resp) {
        throw Error(resp.issue);
      }

      this.dispatch(
        APICONST.SET_DEFAULT_TABLE_QUERY_SUCCESS,
        {
          table: resp.id,
          query: resp.defaultQuery
        }
      );
    })
    .catch((error) => {
      this.dispatch(APICONST.SET_DEFAULT_TABLE_QUERY_FAIL);
      ErrorReport(this.flux, error.message, () => this.flux.actions.api.setDefaultTableQuery({dataset, table, query}));
    });
  }

};

module.exports = APIActions;
