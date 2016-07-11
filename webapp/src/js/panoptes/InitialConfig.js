import API from 'panoptes/API';

//TODO CONFIG SHOULD BE COMPILED SERVER SIDE AND SENT DOWN IN INDEX.HTML, NOT AJAXED IN
let fetchInitialConfig = function (dataset) {
  return API.requestJSON({
    params: {
      datatype: 'custom',
      respmodule: 'panoptesserver',
      respid: 'datasetinfo',
      database: dataset
    }
  })
    .then((resp) => {
      if (resp.needfullreload)
        console.log('Schema full reload');
      if (resp.needconfigreload)
        console.log('Schema config reload');
      initialConfig.isManager = resp.manager; //eslint-disable-line no-undef
    })
    .then(() => API.requestJSON({
        params: {
          datatype: 'custom',
          respmodule: 'panoptesserver',
          respid: 'getconfig',
          dataset
        }
      }))
    .then((resp) => ({dataset, ...resp.config}));
};

module.exports = fetchInitialConfig;


//parse graph info  TREE INFO NEEDS TO COME FROM SERVER
// fetchedConfig.tables.forEach((tableInfo) => {
//   tableInfo.trees = [];
//   tableInfo.treesById = {};
// });
// fetchedConfig.graphs.forEach((graphInfo) => {
//   if (graphInfo.tpe == 'tree') {
//     const tree = {
//       id: graphInfo.graphid,
//       name: graphInfo.dispname,
//       crossLink: graphInfo.crosslnk
//     };
//     fetchedConfig.tablesByID[graphInfo.id].trees.push(tree);
//     fetchedConfig.tablesByID[graphInfo.id].treesById[ graphInfo.graphid] = tree;
//   }
// });
