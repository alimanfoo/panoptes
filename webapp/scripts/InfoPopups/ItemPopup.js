// This file is part of Panoptes - (C) Copyright 2014, CGGH <info@cggh.org>
// This program is free software licensed under the GNU Affero General Public License. 
// You can find a copy of this license in LICENSE in the top directory of the source code or at <http://opensource.org/licenses/AGPL-3.0>
define(["require", "DQX/base64", "DQX/Application", "DQX/Framework", "DQX/Controls", "DQX/Msg", "DQX/SQL", "DQX/DocEl", "DQX/Utils", "DQX/QueryTable", "DQX/Map",
    "DQX/Wizard", "DQX/Popup", "DQX/PopupFrame", "DQX/ChannelPlot/GenomePlotter", "DQX/ChannelPlot/ChannelYVals", "DQX/ChannelPlot/ChannelPositions", "DQX/ChannelPlot/ChannelSequence","DQX/DataFetcher/DataFetchers", "DQX/DataFetcher/DataFetcherSummary",
    "MetaData", "Utils/GetFullDataItemInfo", "Utils/MiscUtils", "InfoPopups/ItemGenomeTracksPopup",
    "InfoPopups/DataItemViews/DefaultView", "InfoPopups/DataItemViews/ItemMap", "InfoPopups/DataItemViews/PieChartMap", "InfoPopups/DataItemViews/FieldList", "InfoPopups/DataItemViews/PropertyGroup"
],
    function (require, base64, Application, Framework, Controls, Msg, SQL, DocEl, DQX, QueryTable, Map,
              Wizard, Popup, PopupFrame, GenomePlotter, ChannelYVals, ChannelPositions, ChannelSequence, DataFetchers, DataFetcherSummary,
              MetaData, GetFullDataItemInfo, MiscUtils, ItemGenomeTracksPopup,
              ItemView_DefaultView, ItemView_ItemMap, ItemView_PieChartMap, ItemView_FieldList, ItemView_PropertyGroup
        ) {

        var ItemPopup = {};
        ItemPopup.activeList = [];

        ItemPopup.init = function() {
            Msg.listen('',{type:'ItemPopup'}, function(scope, info) {
                ItemPopup.show(info);
            });
        }

        ItemPopup.show = function(itemInfo) {
            DQX.setProcessing("Downloading...");
            GetFullDataItemInfo.Get(itemInfo.tableid, itemInfo.itemid, function(resp) {
                DQX.stopProcessing();
                ItemPopup.show_sub1(itemInfo, resp);
            })
        }


        ItemPopup.show_sub1 = function(itemInfo, data) {


            var tableInfo = MetaData.getTableInfo(itemInfo.tableid);
            var that = PopupFrame.PopupFrame('ItemPopup'+itemInfo.tableid,
                {
                    title:tableInfo.tableCapNameSingle + ' "'+itemInfo.itemid+'"',
                    icon:tableInfo.settings.Icon,
                    blocking:false,
                    sizeX:700, sizeY:500
                }
            );
            that.itemid = itemInfo.itemid;
            that.tableInfo = MetaData.getTableInfo(itemInfo.tableid);

            if (MetaData.isManager)
                that.addTool('fa-link', function() { that.handleCreateLink(); });

            if (itemInfo.frameSettings) {
                // Popupframe settings were stored; recall & set as new history, so that settings will be picked up during creation
                PopupFrame.setFrameSettingsHistory(that.typeID, itemInfo.frameSettings);
            }

            that.eventids = [];//Add event listener id's to this list to have them removed when the popup closes
            var eventid = DQX.getNextUniqueID();that.eventids.push(eventid);
            Msg.listen(eventid, { type: 'SelectionUpdated'}, function(scope,tableid) {
                if (that.tableInfo.id==tableid) {
                    that._selchk.modifyValue(that.tableInfo.isItemSelected(that.itemid), true);
                }
            } );


            that.createFrames = function() {
                that.frameRoot.makeGroupVert();

                var frameTabGroup = that.frameRoot.addMemberFrame(Framework.FrameGroupTab('', 0.7));

                that.frameButtons = that.frameRoot.addMemberFrame(Framework.FrameFinal('', 0.3))
                    .setFixedSize(Framework.dimY, 80).setFrameClassClient('DQXGrayClient').setAllowScrollBars(false, false).setMargins(0);




                that.itemViewObjects = [];
                if (that.tableInfo.settings.DataItemViews)
                    var dataItemViews = that.tableInfo.settings.DataItemViews;
                else { //Fill with defaults
                    var dataItemViews = [];
                    dataItemViews.push({ Type: 'Overview', Name: 'Overview' });
                    if (that.tableInfo.hasGeoCoord)
                        dataItemViews.push({ Type: 'ItemMap', Name: 'Location' });
                }
                $.each(dataItemViews, function(idx, dtViewInfo) {
                    var dtViewObject = null;
                    if (dtViewInfo.Type == 'Overview') {
                        dtViewObject = ItemView_DefaultView.create(dtViewInfo, that.tableInfo, data);
                    }
                    if (dtViewInfo.Type == 'PieChartMap') {
                        dtViewObject = ItemView_PieChartMap.create(dtViewInfo, that.tableInfo, data);
                    }
                    if (dtViewInfo.Type == 'ItemMap') {
                        dtViewObject = ItemView_ItemMap.create(dtViewInfo, that.tableInfo, data);
                    }
                    if (dtViewInfo.Type == 'FieldList') {
                        dtViewObject = ItemView_FieldList.create(dtViewInfo, that.tableInfo, data);
                    }
                    if (dtViewInfo.Type == 'PropertyGroup') {
                        dtViewObject = ItemView_PropertyGroup.create(dtViewInfo, that.tableInfo, data);
                        dtViewInfo.Name = '-Absent-';
                        var groupInfo = that.tableInfo.propertyGroupMap[dtViewInfo.GroupId];
                        if (groupInfo)
                            dtViewInfo.Name = groupInfo.Name;
                    }
                    if (!dtViewObject)
                        DQX.reportError("Invalid dataitem view type "+dtViewInfo.Type);
                    that.itemViewObjects.push(dtViewObject);
                    frameTabGroup.addMemberFrame(dtViewObject.createFrames())
                        .setDisplayTitle(dtViewInfo.Name);
                });

                that.childRelationTabs = [];
                $.each(that.tableInfo.relationsParentOf, function(idx,relationInfo) {
                    var relTab = {};
                    relTab.relationInfo = relationInfo;
                    relTab.childTableInfo = MetaData.mapTableCatalog[relationInfo.childtableid];
                    var frameRelation = frameTabGroup.addMemberFrame(Framework.FrameGroupHor('', 0.7))
                        .setDisplayTitle(relationInfo.reversename + ' ' + relTab.childTableInfo.tableNamePlural);
                    relTab.frameButtons = frameRelation.addMemberFrame(Framework.FrameFinal('', 0.3))
                        .setFixedSize(Framework.dimX, 150)/*.setFrameClassClient('DQXGrayClient')*/;
                    relTab.frameTable = frameRelation.addMemberFrame(Framework.FrameFinal('', 0.7))
                        .setAllowScrollBars(true,true);
                    that.childRelationTabs.push(relTab);
                });

                if (!that.tableInfo.settings.DisableSubsets) {
                    that.frameSubsets = frameTabGroup.addMemberFrame(Framework.FrameFinal('', 0.7))
                        .setDisplayTitle('Subsets').setMargins(10);
                }
            };

            that.createPanels = function() {
                that.panelButtons = Framework.Form(that.frameButtons);

                that.buttonWidth = 160;
                that.buttonHeight = 30;


                var buttons = [];

                if (that.tableInfo.hasGenomePositions) {
                    var genome_chromosome = data.fields[that.tableInfo.ChromosomeField];
                    var genome_position = parseInt(data.fields[that.tableInfo.PositionField]);
                    if (genome_chromosome) {
                        var bt = Controls.Button(null, { content: 'Show on genome', buttonClass: 'PnButtonGrid', width:that.buttonWidth, height:that.buttonHeight, bitmap:'Bitmaps/GenomeBrowserSmall.png'}).setOnChanged(function() {
                            PopupFrame.minimiseAll({ slow: true});
                            Msg.send({ type: 'JumpgenomePosition' }, {
                                chromoID: genome_chromosome,
                                position: genome_position
                            });
                        })
                        buttons.push(bt);
                    }

                    // Create buttons to show genomic regions spanning this position
                    $.each(MetaData.tableCatalog, function(idx, oTableInfo) {
                        if (oTableInfo.hasGenomeRegions) {
                            var bt = Controls.Button(null, {
                                content: 'Show '+oTableInfo.tableNamePlural,
                                buttonClass: 'PnButtonGrid',
                                width:that.buttonWidth,
                                height:that.buttonHeight,
                                bitmap: (!oTableInfo.settings.Icon)?'Bitmaps/datagrid2Small.png':null,
                                icon: oTableInfo.settings.Icon
                            }).setOnChanged(function() {
                                var qry = SQL.WhereClause.AND([
                                    SQL.WhereClause.CompareFixed(oTableInfo.settings.Chromosome, '=', genome_chromosome),
                                    SQL.WhereClause.CompareFixed(oTableInfo.settings.RegionStart, '<=', genome_position),
                                    SQL.WhereClause.CompareFixed(oTableInfo.settings.RegionStop, '>=', genome_position)
                                ]);
                                Msg.send({type: 'DataItemTablePopup'}, {
                                    tableid: oTableInfo.id,
                                    query: qry,
                                    title: oTableInfo.tableCapNamePlural + ' at ' + genome_chromosome + ':' + genome_position
                                });
                            })
                            buttons.push(bt);
                        }
                    });
                }

                if (that.tableInfo.hasGenomeRegions) {
                    var bt = Controls.Button(null, { content: 'Show on genome', buttonClass: 'PnButtonGrid', width:that.buttonWidth, height:that.buttonHeight, bitmap:'Bitmaps/GenomeBrowserSmall.png'}).setOnChanged(function() {
                        PopupFrame.minimiseAll({ slow: true});
                        Msg.send({ type: 'JumpgenomeRegion' }, {
                            chromoID: data.fields[that.tableInfo.settings.Chromosome],
                            start: parseInt(data.fields[that.tableInfo.settings.RegionStart]),
                            end: parseInt(data.fields[that.tableInfo.settings.RegionStop])
                        });
                    })
                    buttons.push(bt);

                    $.each(MetaData.tableCatalog,  function(idx, tableInfo) {
                        if (tableInfo.hasGenomePositions) {
                            var bt = Controls.Button(null, {
                                content: 'Show '+tableInfo.tableNamePlural+' in range',
                                buttonClass: 'PnButtonGrid',
                                width:that.buttonWidth,
                                height:that.buttonHeight,
                                bitmap: (!tableInfo.settings.Icon)?'Bitmaps/datagrid2Small.png':null,
                                icon: tableInfo.settings.Icon
                            }).setOnChanged(function() {
                                Msg.send({type: 'ShowItemsInGenomeRange', tableid:tableInfo.id}, {
                                    preservecurrentquery:false,
                                    chrom: data.fields[that.tableInfo.settings.Chromosome],
                                    start: parseInt(data.fields[that.tableInfo.settings.RegionStart]),
                                    stop: parseInt(data.fields[that.tableInfo.settings.RegionStop])
                                });
                            })
                            buttons.push(bt);
                        }
                    });
                }

                var reverseCrossLinkInfoList = MiscUtils.getReverseCrossLinkList(that.tableInfo.id, that.itemid);
                $.each(reverseCrossLinkInfoList, function(idx, linkInfo) {
                    var bt = Controls.Button(null, { content: 'Show associated '+linkInfo.dispName, buttonClass: 'PnButtonGrid', width:that.buttonWidth, height:that.buttonHeight, bitmap:linkInfo.bitmap, bitmapHeight:20}).setOnChanged(function() {
                        MiscUtils.openReverseCrossLink(linkInfo);
                        });
                    buttons.push(bt);
                });

                if (that.tableInfo.tableBasedSummaryValues.length>0) {
                    var bt = Controls.Button(null, { content: 'Show genome tracks...', buttonClass: 'PnButtonGrid', width:that.buttonWidth, height:that.buttonHeight, bitmap:'Bitmaps/GenomeBrowserSmall.png'}).setOnChanged(function() {
                        ItemGenomeTracksPopup.show(that.tableInfo, that.itemid);
                    })
                    buttons.push(bt)
                }

                if (that.tableInfo.settings.ExternalLinks) {
                    $.each(that.tableInfo.settings.ExternalLinks, function(idx, linkInfo) {
                        var bt = Controls.Button(null, { content: linkInfo.Name, buttonClass: 'PnButtonGrid', width:that.buttonWidth, height:that.buttonHeight, icon:"fa-link"}).setOnChanged(function() {
                            var url = linkInfo.Url.DQXformat(data.fields);
                            window.open(url,'_blank');
                        })
                        buttons.push(bt)
                    });
                }

                that._selchk = Controls.Check(null, {
                        label: 'Select',
                        value: that.tableInfo.isItemSelected(that.itemid)
                    }).setOnChanged(function() {
                        that.tableInfo.selectItem(that.itemid, that._selchk.getValue());
                        Msg.broadcast({type:'SelectionUpdated'}, that.tableInfo.id);
                })
                buttons.push(Controls.Wrapper(that._selchk,'PnGridCheckWrapper'));

                var currentCol = null;
                var cols = [];
                var rowNr = 99;
                $.each(buttons, function(idx, button) {
                    if (rowNr>1) {
//                        if (cols.length>0)
//                            cols.push(Controls.HorizontalSeparator(7));
                        currentCol = Controls.CompoundVert([]).setTreatAsBlock().setMargin(0);
                        cols.push(currentCol);
                        rowNr = 0;
                    }
//                    if (rowNr>0)
//                        currentCol.addControl(Controls.VerticalSeparator(1));
                    currentCol.addControl(button);
                    rowNr += 1;
                });

                that.panelButtons.addControl(Controls.CompoundHor(cols));

                that.createPanelsRelations();

                $.each(that.itemViewObjects, function(idx, dtViewObject) {
                    dtViewObject.createPanels();
                });

                that.createSubsetsControls();
            }

            that.createSubsetsControls = function() {
                if (!that.tableInfo.settings.DisableSubsets) {
                    that.panelSubsets = Framework.Form(that.frameSubsets);

                    var subsetCheckList = [];
                    var subsetCheckMap = {};
                    $.each(that.tableInfo.storedSubsets, function(idx, subset) {
                        var chk = Controls.Check(null, {label:subset.name});
                        subsetCheckList.push(chk);
                        subsetCheckMap[subset.id] = chk;
                        chk.modifyEnabled(false);
                        chk.setOnChanged(function() {
                            DQX.customRequest(MetaData.serverUrl, PnServerModule, 'subset_setitemselection',
                                {
                                    database: MetaData.database,
                                    tableid: that.tableInfo.id,
                                    workspaceid: MetaData.workspaceid,
                                    itemid: that.itemid,
                                    isnumericalkey: isnumericalkey?1:0,
                                    primkey: that.tableInfo.primkey,
                                    subsetid: subset.id,
                                    ismember: chk.getValue()?1:0
                                }
                                , function(resp) {
                                    subset.membercount += resp.diff;
                                });
                        });
                    });
                    if (subsetCheckList.length == 0) {
                        that.panelSubsets.addControl(Controls.Static('There are currently no {name} subsets defined'.DQXformat({name: that.tableInfo.tableNameSingle})));
                    }
                    else {
                        that.panelSubsets.addControl(Controls.CompoundVert([
                            Controls.Static('This {name} is member of the following subsets:<p>'.DQXformat({name: that.tableInfo.tableNameSingle})),
                            Controls.CompoundVert(subsetCheckList)
                        ]));
                    }

                    var isnumericalkey = !!(MetaData.findProperty(that.tableInfo.id, that.tableInfo.primkey).isFloat);
                    DQX.customRequest(MetaData.serverUrl, PnServerModule, 'subset_getitemselection',
                        {
                            database: MetaData.database,
                            tableid: that.tableInfo.id,
                            workspaceid: MetaData.workspaceid,
                            itemid: that.itemid,
                            isnumericalkey: isnumericalkey?1:0,
                            primkey: that.tableInfo.primkey
                        }
                        , function(resp) {
                            $.each(subsetCheckList, function(idx, chk) {
                                chk.modifyEnabled(true);
                            })
                            $.each(resp.subsetmemberlist, function(idx, activesubset) {
                                if (subsetCheckMap[activesubset])
                                    subsetCheckMap[activesubset].modifyValue(true, true);
                            });
                        });
                }
            }

            that.createPanelsRelations = function() {
                $.each(that.childRelationTabs, function(idx, relTab) {

                    //Initialise the data fetcher that will download the data for the table
                    var theDataFetcher = DataFetchers.Table(
                        MetaData.serverUrl,
                        MetaData.database,
                        relTab.childTableInfo.getQueryTableName(false)
                    );
                    theDataFetcher.setReportIfError(true);

                    relTab.panelTable = QueryTable.Panel(
                        relTab.frameTable,
                        theDataFetcher,
                        { leftfraction: 50 }
                    );
                    var theTable = relTab.panelTable.getTable();
                    theTable.fetchBuffer = 300;
                    theTable.recordCountFetchType = DataFetchers.RecordCountFetchType.DELAYED;
                    var theQuery = SQL.WhereClause.CompareFixed(relTab.relationInfo.childpropid, '=', data.fields[that.tableInfo.primkey]);
                    theTable.setQuery(theQuery);


                    $.each(MetaData.customProperties, function(idx, propInfo) {
                        if ( (propInfo.tableid == relTab.childTableInfo.id) && (propInfo.propid!=relTab.relationInfo.childpropid) ) {
                            var col = MiscUtils.createItemTableViewerColumn(theTable, relTab.childTableInfo.id, propInfo.propid);
                        }
                    });
//                    $.each(relTab.childTableInfo.quickFindFields, function(idx, propid) {
//                        if (propid!=relTab.relationInfo.childpropid) {
//                            var propInfo = MetaData.findProperty(relTab.childTableInfo.id,propid);
//                            var col = MiscUtils.createItemTableViewerColumn(theTable, relTab.childTableInfo.id, propid);
//
//                        }
//                    });
//                    that.updateQuery();
                    relTab.panelTable.onResize();

                    var buttons = [];


                    relTab.panelButtons = Framework.Form(relTab.frameButtons);
                    var button_OpenInTable = Controls.Button(null, { content: 'Show in table view', icon:'fa-table', buttonClass:'PnButtonGrid' ,width:135, height:35}).setOnChanged(function() {
                        var qry = SQL.WhereClause.CompareFixed(relTab.relationInfo.childpropid, '=', data.fields[that.tableInfo.primkey]);
                        Msg.send({type: 'DataItemTablePopup'}, {
                            tableid: relTab.childTableInfo.id,
                            query: qry,
                            title: ''//that.tableInfo.tableCapNamePlural + ' at ' + pieChartInfo.longit + ', ' + pieChartInfo.lattit
                        });
//                        Msg.send({type: 'ShowItemsInSimpleQuery', tableid:relTab.childTableInfo.id},
//                            { propid:relTab.relationInfo.childpropid, value:data.fields[that.tableInfo.primkey] }
//                        );
                    })
                    buttons.push(button_OpenInTable);

                    if (relTab.childTableInfo.hasGeoCoord) {
                        var button_OpenInMap = Controls.Button(null, { content: 'Show on map'}).setOnChanged(function() {
                            Msg.send({type: 'CreateGeoMapPoint' },
                                {
                                    tableid: relTab.childTableInfo.id,
                                    startQuery: theQuery
                                });
                            }
                        );
                        buttons.push(button_OpenInMap);
                    }

                    relTab.panelButtons.addControl(Controls.CompoundHor(buttons));

                });
            }

            that.onClose = function() {
                var activeIndex = -1;
                $.each(ItemPopup.activeList, function(idx,popup) {
                    if (popup===that)
                        activeIndex = idx;
                });
                if (activeIndex>=0) {
                    ItemPopup.activeList.splice(activeIndex,1);
                }
                else
                    DQX.reportError('Plot not found!');

                $.each(that.itemViewObjects, function(idx, dtViewObj) {
                    dtViewObj.onClose();
                });

                $.each(that.eventids,function(idx,eventid) {
                    Msg.delListener(eventid);
                });
            };

            that.store = function() {
                var obj = {};
                obj.itemid = that.itemid;
                obj.tableid = that.tableInfo.id;
                obj.frameSettings = that.frameRoot.settingsStreamOut();
                return obj;
            };

            that.handleCreateLink = function() {
                var content = base64.encode(JSON.stringify(that.store()));
                DQX.serverDataStore(MetaData.serverUrl, content, function (id) {
                    DQX.customRequest(MetaData.serverUrl, PnServerModule, 'view_store',
                        { database: MetaData.database, workspaceid: MetaData.workspaceid, id: id },
                        function (resp) {
                            require("Utils/IntroViews").createIntroView('dataitem', id, '-', 'Add {name} to start page'.DQXformat({name:that.tableInfo.tableNameSingle}));
                        });
                });
            }

            ItemPopup.activeList.push(that);
            that.create();
        }



        ItemPopup.store = function() {
            var obj = [];
            $.each(ItemPopup.activeList, function(idx,popup) {
                obj.push(popup.store());
            });
            return obj;
        }

        ItemPopup.recall = function(settObj) {
            $.each(settObj, function(idx,popupSettObj) {
                ItemPopup.show(popupSettObj);
            });
        }

        ItemPopup.loadStoredItem = function(tpe, storeid) {
            DQX.serverDataFetch(MetaData.serverUrl, storeid, function(content) {
                var obj = JSON.parse(base64.decode(content));
                ItemPopup.recall([obj]);
            });
        };


        Msg.listen('', { type: 'LoadStoredDataItem'}, ItemPopup.loadStoredItem);

        return ItemPopup;
    });



