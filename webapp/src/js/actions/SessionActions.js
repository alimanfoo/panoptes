import React from  'react';
import Constants from '../constants/Constants';
const SESSION = Constants.SESSION;

import serialiseComponent from 'util/serialiseComponent';
import EmptyTab from 'containers/EmptyTab';


let SessionActions = {
  componentSetProps(componentPath, updater) {
    this.dispatch(SESSION.COMPONENT_SET_PROPS, {
      componentPath,
      updater,
    });
  },
  componentReplace(componentPath, newComponent) {
    this.dispatch(SESSION.COMPONENT_REPLACE, {
      componentPath,
      newComponent: serialiseComponent(newComponent)
    });
  },
  modalClose() {
    this.dispatch(SESSION.MODAL_CLOSE);
  },
  modalOpen(component, props) {
    this.dispatch(SESSION.MODAL_OPEN, {component, props});
  },
  notify(notification) {
    this.dispatch(SESSION.NOTIFY, notification);
  },
  popupClose(compId) {
    this.dispatch(SESSION.POPUP_CLOSE, {compId});
  },
  popupOpen(component, switchTo = true) {
    this.dispatch(SESSION.POPUP_OPEN, {
      component: serialiseComponent(component),
      switchTo
    });
  },
  popupFocus(compId) {
    this.dispatch(SESSION.POPUP_FOCUS, {compId});
  },
  popupMove(compId, pos) {
    this.dispatch(SESSION.POPUP_MOVE, {compId, pos});
  },
  popupResize(compId, size) {
    this.dispatch(SESSION.POPUP_RESIZE, {compId, size});
  },
  popupToTab(compId) {
    this.dispatch(SESSION.POPUP_TO_TAB, {compId});
  },
  tabClose(compId) {
    this.dispatch(SESSION.TAB_CLOSE, {compId});
  },
  tabOpen(component, switchTo = true) {
    if (!component) {
      component = <EmptyTab />;
    }
    this.dispatch(SESSION.TAB_OPEN, {
      component: serialiseComponent(component),
      switchTo
    });
  },
  tabPopOut(compId, pos) {
    this.dispatch(SESSION.TAB_POP_OUT, {compId, pos});
  },
  tabSwitch(compId) {
    this.dispatch(SESSION.TAB_SWITCH, {compId});
  },
  geneFound(geneId) {
    this.dispatch(SESSION.GENE_FOUND, {
      geneId: geneId
    });
  },
  tableQueryUsed(table, query) {
    this.dispatch(SESSION.TABLE_QUERY_USED, {
      table: table,
      query: query
    });
  },
  appResize() {
    this.dispatch(SESSION.APP_RESIZE, {});
  }

};

module.exports = SessionActions;
