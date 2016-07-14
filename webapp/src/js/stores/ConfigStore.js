import Fluxxor from 'fluxxor';

import Constants from '../constants/Constants';
const APIConst = Constants.API;

import _forEach from 'lodash/forEach';
import SQL from 'panoptes/SQL';
import _values from 'lodash/values';
import _filter from 'lodash/filter';
import _cloneDeep from 'lodash/cloneDeep';

const ConfigStore = Fluxxor.createStore({

  initialize(initConfig) {
    this.state = this.addDerivedConfig(initConfig);
    this.bindActions(
      APIConst.MODIFY_CONFIG_SUCCESS, this.modifyConfigSuccess
    );
  },

  modifyConfigSuccess(payload) {
    const {newConfig} = payload;
    this.state = {...this.state, ...this.addDerivedConfig(newConfig)};
    this.emit('change');
  },

  getState() {
    return this.state;
  },

  columnSpec(list) {
    let ret = {};
    list.forEach((item) => ret[item] = 'ST');
    return ret;
  },

  addDerivedConfig(newConfig) {
    //These mutating methods were copied across, so just clone rather than fixing them up
    newConfig = _cloneDeep(newConfig);
    this.addTableConfig(newConfig);
    this.addPropertyConfig(newConfig);
    this.addRelationConfig(newConfig);
    return newConfig;
  },

  addRelationConfig(config) {
    config.tables.forEach((tableInfo) => {
      tableInfo.relationsChildOf = [];
      tableInfo.relationsParentOf = [];
    });
    config.tables.forEach((childTable) => {
      childTable.properties.forEach((prop) => {
        const relation = prop.relation;
        if (relation) {
          relation.childTable = childTable;
          relation.parentTable = config.tablesById[relation.tableId];
          relation.childPropId = prop.id;
          relation.childTable.relationsChildOf.push(relation);
          relation.parentTable.relationsParentOf.push(relation);
        }
      });
    });
    return config;
  },

  addTableConfig(config) {
    config.tables = _values(config.tablesById);
    config.visibleTables = _filter(config.tables, (table) => !table.isHidden);
    _forEach(config.tablesById, (table, id) => table.id = id);
    if (config.settings.dataTables) {
      config.tables = [];
      config.settings.dataTables.forEach((id) => {
        config.tables.push(config.tablesById[id]);
      });
    }
    config.tables.forEach((table) => {
      table.hasGenomePositions = table.isPositionOnGenome == '1';
      table.nameSingle = table.nameSingle || table.name;
      table.namePlural = table.namePlural || table.name;
      table.capNameSingle = table.nameSingle.charAt(0).toUpperCase() + table.nameSingle.slice(1);
      table.capNamePlural = table.namePlural.charAt(0).toUpperCase() + table.namePlural.slice(1);
      table.quickFindFields = table.quickFindFields ? table.quickFindFields.split(',') : [table.primKey];
      //TODO Remove the fa here for now - should be in settings
      if (table.icon)
        table.icon = table.icon.substring(3);
      else
        table.icon = 'table';
      table.fetchTableName = table.id + 'CMB_' + initialConfig.workspace;
      table.fetchSubsamplingTableName = table.id + 'CMBSORTRAND_' + initialConfig.workspace;
      table.propertyGroupsById = {};
      table.propertyGroups.forEach((group) => {
        table.propertyGroupsById[group.id] = group;
        group.properties = []; //Added later in addPropertyConfig
      });
      if (table.defaultQuery === '')
        table.defaultQuery = SQL.nullQuery;
      table.trees = table.trees || [];
    });
    return config;
  },

//let augment2DTableInfo = function(table) {
//  table.tableNameSingle = table.name;
//  table.tableNamePlural = table.name;
//  if (table.NameSingle)
//    table.tableNameSingle = table.NameSingle;
//  if (table.NamePlural)
//    table.tableNamePlural = table.NamePlural;
//  table.capNameSingle = table.tableNameSingle.charAt(0).toUpperCase() + table.tableNameSingle.slice(1);
//  table.capNamePlural = table.tableNamePlural.charAt(0).toUpperCase() + table.tableNamePlural.slice(1);
//
//  table.col_table = MetaData.tablesByID[table.col_table];
//  table.row_table = MetaData.tablesByID[table.row_table];
//  table.hasGenomePositions = table.col_table.hasGenomePositions;
//  let settings = {};
//  if (table)
//    settings = _.extend(settings, JSON.parse(table));
//  settings.GenomeMaxViewportSizeX = parseInt(settings.GenomeMaxViewportSizeX);
//  table = settings;
//};

  addPropertyConfig(config) {
    let promises = [];
    config.tables.forEach((table) => {
      table.properties = table.properties || [];
      table.propertiesById = {};
      table.properties.forEach((prop) => {
        table.propertiesById[prop.id] = prop;
        prop.tableId = table.id;
        if (prop.dataType == 'Text')
          prop.isText = true;
        if ((prop.dataType == 'Value') || (prop.dataType == 'LowPrecisionValue') || (prop.dataType == 'HighPrecisionValue') || (prop.dataType == 'GeoLongitude') || (prop.dataType == 'GeoLatitude') || (prop.dataType == 'Date'))
          prop.isFloat = true;
        if (prop.dataType == 'Boolean')
          prop.isBoolean = true;
        if (prop.dataType == 'Date')
          prop.isDate = true;
        if (!prop.name) prop.name = prop.id;
        if (prop.isFloat) {
          prop.minVal = prop.minVal || 0;
          prop.maxVal = prop.maxVal || 1;
          prop.decimDigits = prop.decimDigits || 2;
        }
        if (prop.dataType == 'GeoLongitude') {
          prop.minVal = prop.minVal || 0;
          prop.maxVal = prop.maxVal || 360;
          prop.decimDigits = prop.decimDigits || 5;
          table.longitude = prop.id;
        }
        if (prop.dataType == 'GeoLatitude') {
          prop.minVal = prop.minVal || -90;
          prop.maxVal = prop.maxVal || 90;
          prop.decimDigits = prop.decimDigits || 5;
          table.latitude = prop.id;
        }
        if (prop.id == table.primKey)
          prop.isPrimKey = true;
        prop.hasValueRange = !!prop.maxVal;

        // Human friendly data type string
        prop.dispDataType = 'Text';
        prop.icon = 'font';
        if (prop.isCategorical) {
          prop.dispDataType = 'Categorical';
          prop.icon = 'bar-chart';
        }
        if (prop.isFloat) {
          prop.dispDataType = 'Value';
          prop.icon = 'line-chart';
        }
        if (prop.isBoolean) {
          prop.dispDataType = 'Boolean';
          prop.icon = 'check-square-o';
        }
        if (prop.isDate) {
          prop.dispDataType = 'Date';
          prop.icon = 'calendar';
        }
        if (prop.dataType == 'GeoLongitude') {
          prop.dispDataType = 'Longitude';
          prop.icon = 'globe';
        }
        if (prop.dataType == 'GeoLatitude') {
          prop.dispDataType = 'Latitude';
          prop.icon = 'globe';
        }

        //Assign property group
        if (prop.groupId)
          if (table.propertyGroupsById[prop.groupId]) {
            table.propertyGroupsById[prop.groupId].properties.push(prop);
          }
        if (!prop.groupId) {
          if (!table.propertyGroupsById['_UNGROUPED_']) {
            table.propertyGroupsById['_UNGROUPED_'] = {id: '_UNGROUPED_', name: 'Properties', properties: []};
          }
          table.propertyGroupsById['_UNGROUPED_'].properties.push(prop);
        }

        // Determine table name where the column is originally defined
        if (prop.source == 'fixed') {
          prop.originalTableName = table.id;
        } else {
          prop.originalTableName = table.id + 'INFO_' + initialConfig.workspace; //eslint-disable-line no-undef
        }

        if (prop.isFloat) {
          if (prop.decimDigits == 0)
            prop.isInt = true;
        }

        if (prop.isDate) {
          table.hasDate = true;
        }

        //Set a recommended encoder - legacy from 1.X
        let encoding = 'String';
        if (prop.dataType == 'Value') {
          encoding = 'Float3';
          if ((prop.decimDigits == 0 ) || (prop.isPrimKey))
            encoding = 'Int';
        }
        if (prop.dataType == 'HighPrecisionValue') {
          encoding = 'FloatH';
        }
        if ((prop.dataType == 'Value') && (prop.id == table.position) && (table.hasGenomePositions))
          encoding = 'Int';
        if (prop.dataType == 'Boolean')
          encoding = 'Int';
        if ((prop.dataType == 'GeoLongitude') || (prop.dataType == 'GeoLatitude'))
          encoding = 'Float4';
        if ((prop.dataType == 'Date'))
          encoding = 'Float4';
        prop.encoding = encoding;

        let encodingTypes = {
          'Generic': 'String',     //returns string data, also works for other data
          'String': 'String',      //returns string data
          'Float2': 'Float',       //returns floats in 2 base64 bytes
          'Float3': 'Float',       //returns floats in 3 base64 bytes
          'Float4': 'Float',       //returns floats in 4 base64 bytes
          'FloatH': 'Float',       //returns floats as string
          'Int': 'Integer',        //returns exact integers
          'IntB64': 'Integer',     //returns exact integers, base64 encoded
          'IntDiff': 'Integer'     //returns exact integers as differences with previous values
        };
        prop.encodingType = encodingTypes[prop.encoding];
        let fetchEncodingTypes = {
          'Generic': 'GN',
          'String': 'ST',
          'Float2': 'F2',
          'Float3': 'F3',
          'Float4': 'F4',
          'FloatH': 'FH',
          'Int': 'IN',
          'IntB64': 'IB',
          'IntDiff': 'ID'
        };
        let displayEncodingTypes = {
          'Generic': 'GN',
          'String': 'ST',
          'Float2': 'FH',
          'Float3': 'FH',
          'Float4': 'FH',
          'FloatH': 'FH',
          'Int': 'IN',
          'IntB64': 'IB',
          'IntDiff': 'ID'
        };
        prop.defaultFetchEncoding = fetchEncodingTypes[prop.encoding];
        prop.defaultDisplayEncoding = displayEncodingTypes[prop.encoding];
        let alignment = {
          Value: 'right',
          HighPrecisionValue: 'right',
          Boolean: 'center',
          GeoLongitude: 'right',
          GeoLatitude: 'right',
          Date: 'center'
        };
        prop.alignment = alignment[prop.dataType] || 'left';
        prop.description = prop.description || '';
        prop.showBar = prop.ShowBar || (prop.barWidth > 0);
        prop.showByDefault = 'tableDefaultVisible' in prop ? prop.tableDefaultVisible :
        prop.isPrimKey ||
        prop.id == table.chromosome ||
        prop.id == table.position ||
        false;
        if (prop.summaryValues) {
          prop.summaryValues.minblocksize = parseFloat(prop.summaryValues.minblocksize);
        }
      });
      table.hasGeoCoord = !!(table.longitude && table.latitude);
    });
    return config;
  }

});

module.exports = ConfigStore;