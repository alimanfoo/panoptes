define(["require", "DQX/base64", "DQX/Application", "DQX/Framework", "DQX/Controls", "DQX/Msg", "DQX/SQL", "DQX/DocEl", "DQX/Utils", "DQX/Wizard", "DQX/ChannelPlot/GenomePlotter", "DQX/ChannelPlot/ChannelYVals", "DQX/ChannelPlot/ChannelPositions", "DQX/ChannelPlot/ChannelSequence","DQX/DataFetcher/DataFetchers", "DQX/DataFetcher/DataFetcherSummary", "Wizards/EditTableBasedSummaryValues", "MetaData"],
    function (require, base64, Application, Framework, Controls, Msg, SQL, DocEl, DQX, Wizard, GenomePlotter, ChannelYVals, ChannelPositions, ChannelSequence, DataFetchers, DataFetcherSummary, EditTableBasedSummaryValues, MetaData) {

        var GenomeBrowserModule = {

            init: function () {
                // Instantiate the view object
                var that = Application.View(
                    'genomebrowser',    // View ID
                    'Genome browser'    // View title
                );
                that.setEarlyInitialisation();


                that.storeSettings = function() {
                    var obj= {};
                    if (that.panelBrowser) {
                        obj.chromoid = that.panelBrowser.getCurrentChromoID();
                        obj.range = that.panelBrowser.getVisibleRange();
                        var markInfo = that.panelBrowser.getMark();
                        if (markInfo)
                            obj.mark = markInfo;
                        obj.settings = Controls.storeSettings(that.visibilityControlsGroup);
                        obj.settingsButtons = Controls.storeSettings(that.buttonsGroup);
                    }
                    return obj;
                };

                that.recallSettings = function(settObj) {
                    if ( (settObj.chromoid) && (that.panelBrowser) ) {
                        that.panelBrowser.setChromosome(settObj.chromoid, true, false);
                        that.panelBrowser.setPosition((settObj.range.max+settObj.range.min)/2, settObj.range.max-settObj.range.min);
                        if (settObj.mark)
                            that.panelBrowser.setMark(settObj.mark.min, settObj.mark.max);
                    }
                    if ((settObj.settings) && (that.visibilityControlsGroup) )
                        Controls.recallSettings(that.visibilityControlsGroup, settObj.settings, false);

                    if ((settObj.settingsButtons) && (that.buttonsGroup) )
                        Controls.recallSettings(that.buttonsGroup, settObj.settingsButtons, false);

                    //Initialise all the table based summary values
                    $.each(MetaData.tableCatalog, function(idx, tableInfo) {
                        that.rebuildTableBasedSummaryValues(tableInfo.id);
                    });
                };


                that.fetchers={};


                that.createFrames = function(rootFrame) {
                    that.filterByQuery = false;
                    rootFrame.makeGroupHor();
                    this.frameControls = rootFrame.addMemberFrame(Framework.FrameFinal('', 0.3));//Create frame that will contain the controls panel
                    this.frameBrowser = rootFrame.addMemberFrame(Framework.FrameFinal('', 0.7));//Create frame that will contain the genome browser panel

                    Msg.listen("", { type: 'JumpgenomeRegion' }, that.onJumpGenomeRegion);
                    Msg.listen("", { type: 'JumpgenomePosition' }, that.onJumpGenomePosition);

                    Msg.listen("", {type: 'QueryChanged'}, function(scope, tableid) {
                        var tableInfo = MetaData.getTableInfo(tableid);
                        if (tableInfo.hasGenomePositions) {
                            if ( (tableInfo.genomeBrowserInfo.dataFetcher) && (tableInfo.genomeBrowserInfo.filterByQuery) )
                                tableInfo.genomeBrowserInfo.dataFetcher.setUserQuery2(tableInfo.currentQuery);
                        }
                    });

                    Msg.listen("", { type: 'TableBasedSummaryValueSelectionChanged' }, function(scope, params) {
                        that.rebuildTableBasedSummaryValues(params.tableid);
                    });

                }



                that.createPanels = function() {
                    this.panelControls = Framework.Form(this.frameControls);
                    this.panelControls.setPadding(10);

                    //Browser configuration settings
                    var browserConfig = {
                        serverURL: MetaData.serverUrl,              //Url of the DQXServer instance used
                        database: MetaData.database,                //Database name
                        annotTableName: MetaData.tableAnnotation,   //Name of the table containing the annotation
                        chromoIdField: 'chrom',                      //Specifies that chromosomes are identifier by *numbers* in the field 'chrom'
                        //*NOTE*: chromosome identifiers can be used by specifying chromoIdField: 'chromid'
                        viewID: '',
                        canZoomVert: true                           //Viewer contains buttons to alter the vertical size of the channels
                    };

                    //Initialise a genome browser panel
                    this.panelBrowser = GenomePlotter.Panel(this.frameBrowser, browserConfig);
                    this.panelBrowser.setMaxXZoomFactor(4.0,6000);

                    //Define chromosomes
                    $.each(MetaData.chromosomes,function(idx,chromosome) {
                        that.panelBrowser.addChromosome(chromosome.id, chromosome.id, chromosome.len);//provide identifier, name, and size in megabases
                    });

                    this.panelBrowser.getAnnotationFetcher().setFeatureType('gene', 'CDS');
                    this.panelBrowser.getAnnotationChannel().setMinDrawZoomFactX(1.0/99999999);

                    if (MetaData.generalSettings.AnnotMaxViewportSize)
                        this.panelBrowser.getAnnotationChannel().setMaxViewportSizeX(MetaData.generalSettings.AnnotMaxViewportSize*1.0E6);

                    //Define the action when a user clicks on a gene in the annotation channel
                    this.panelBrowser.getAnnotationChannel().handleFeatureClicked = function (geneID) {
                        Msg.send({type:'GenePopup'}, geneID);
                    }

                    if (MetaData.generalSettings.RefSequenceSumm) {
                        SeqChannel = ChannelSequence.Channel(MetaData.serverUrl, 'SummaryTracks/' + MetaData.database+'/Sequence', 'Summ');
                        this.panelBrowser.addChannel(SeqChannel, true);

                    }

                    var bt = Controls.Button(null, { buttonClass: 'DQXToolButton2', content: "Show visible variants in table",  width:120, height:30 }).setOnChanged(function() {
                        var chromoid = that.panelBrowser.getCurrentChromoID();
                        var range = that.panelBrowser.getVisibleRange();
                        Msg.send({type: 'ShowSNPsInRange'}, {
                            preservecurrentquery:(that.ctrl_filtertype.getValue()=='query'),
                            chrom:chromoid, start:range.min, stop:range.max
                        });
                    });

                    that.visibilityControlsGroup = Controls.CompoundVert([]);

                    //Create controls for each table that has genome summary tracks defined
                    that.buttonsGroup = Controls.CompoundVert([]);
                    $.each(MetaData.tableCatalog,function(idx,tableInfo) {
                        if (tableInfo.tableBasedSummaryValues.length>0) {
                            var bt = Controls.Button(null, { buttonClass: 'DQXToolButton2', content: "Select active "+tableInfo.name+"...",  width:140 }).setOnChanged(function() {
                                EditTableBasedSummaryValues.prompt(tableInfo.id);
                            });
                            states = [];
                            $.each(tableInfo.quickFindFields, function(idx, propid) {
                                states.push({id: propid, name: MetaData.findProperty(tableInfo.id,propid).name});
                            });
                            tableInfo.genomeBrowserFieldChoice = Controls.Combo(null,{label:'Displayed field', states: states}).setClassID('genometrack_displayedfields_'+tableInfo.id);
                            tableInfo.genomeBrowserFieldChoice.setOnChanged(function() {
                                that.updateTableBasedSummaryValueHeaders();
                            });
                            var activeTrackList = [];
                            $.each(tableInfo.tableBasedSummaryValues, function(idx, summaryValue) {
                                var chk = Controls.Check(null, {label:summaryValue.trackname, value:summaryValue.settings.defaultVisible}).setClassID('trackactive_'+tableInfo.id+'_'+summaryValue.trackid).setOnChanged(function() {
                                    tableInfo.mapTableBasedSummaryValues[chk.trackid].isVisible = chk.getValue();
                                    that.rebuildTableBasedSummaryValues(tableInfo.id);
                                });
                                chk.trackid = summaryValue.trackid;
                                activeTrackList.push(chk);
                            });
                            that.buttonsGroup.addControl(Controls.CompoundVert([
                                bt,
                                tableInfo.genomeBrowserFieldChoice,
                                Controls.CompoundVert(activeTrackList)
                            ]).setLegend('<h3>'+tableInfo.name+' tracks</h3>'));
                        }
                    });


                    this.panelControls.addControl(Controls.CompoundVert([
                        bt,
                        that.visibilityControlsGroup,
                        that.buttonsGroup
                    ]));

                    that.reLoad();

                    Msg.listen('', {type:'TableFieldCacheModified'}, function() {
                        that.updateTableBasedSummaryValueHeaders();
                    });

                };




                that.onBecomeVisible = function() {
                    if (that.visibilityControlsGroup)
                        that.reLoad();
                }


                //Call this function to jump to & highlight a specific region on the genome
                // need args.chromoID, args.start, args.end
                that.onJumpGenomeRegion = function (context, args) {
                    if ('chromoID' in args)
                        var chromoID = args.chromoID;
                    else {
                        DQX.assertPresence(args, 'chromNr');
                        var chromoID = that.panelBrowser.getChromoID(args.chromNr);
                    }
                    DQX.assertPresence(args, 'start'); DQX.assertPresence(args, 'end');
                    that.activateState();
                    that.panelBrowser.highlightRegion(chromoID, (args.start + args.end) / 2, args.end - args.start);
                };

                //Call this function to jump to & highlight a specific position on the genome
                // need args.chromoID, args.position
                that.onJumpGenomePosition = function (context, args) {
                    if ('chromoID' in args)
                        var chromoID = args.chromoID;
                    else {
                        DQX.assertPresence(args, 'chromNr');
                        var chromoID = that.panelBrowser.getChromoID(args.chromNr);
                    }
                    DQX.assertPresence(args, 'position');
                    that.activateState();
                    that.panelBrowser.highlightRegion(chromoID, args.position, 0);
                };


                // Returns a summary fetcher compatible with a track with a given minimum block size
                // For efficiency, fetchers automatically pool tracks up to a given maximum count
                that.getSummaryFetcher =function(minblocksize) {
                    //Try to find suitable existing fetcher
                    var theFetcher = null;
                    $.each(that.listDataFetcherProfiles,function(idx,fetcher) {
                        if ( (fetcher.minblocksize==minblocksize) && (fetcher.usedChannelCount<30) )
                            theFetcher = fetcher;
                    });
                    if (!theFetcher) {
                        theFetcher = new DataFetcherSummary.Fetcher(MetaData.serverUrl,minblocksize,800);
                        theFetcher.usedChannelCount = 0;
                        theFetcher.minblocksize=minblocksize;
                        that.listDataFetcherProfiles.push(theFetcher);
                    }
                    theFetcher.usedChannelCount++;
                    return theFetcher;
                }

                //Creates channels in the browser that displaying various summary properties
                that.createSummaryChannels = function() {

                    if (MetaData.summaryValues.length==0)
                        return;

                    //Iterate over all summary profiles shown by the app
                    $.each(MetaData.summaryValues,function(idx,summaryValue) {
                        if (!summaryValue.isDisplayed) {//Notr: this flag is set if that summary value was associated with a datatable property
                            var trackid ='smm'+summaryValue.tableid+'_'+summaryValue.propid;
                            var theFetcher = that.getSummaryFetcher(summaryValue.minblocksize);
                            var channelid=trackid;
                            var folder=that.summaryFolder+'/'+summaryValue.propid;//The server folder where to find the info, relative to the DQXServer base path

                            var SummChannel = that.channelMap[channelid];
                            if (!SummChannel) {
                                var SummChannel = ChannelYVals.Channel(channelid, { minVal: summaryValue.minval, maxVal: summaryValue.maxval });//Create the channel
                                SummChannel
                                    .setTitle(summaryValue.name).setHeight(120, true)
                                    .setChangeYScale(true,true);//makes the scale adjustable by dragging it
                                SummChannel.controls = Controls.CompoundVert([]);
                                that.panelBrowser.addChannel(SummChannel);//Add the channel to the browser
                                that.channelMap[channelid] = SummChannel;
                            }

                            that.listSummaryChannels.push(channelid);

                            var theColor = DQX.parseColorString(summaryValue.settings.channelColor);;

                            //Create the min-max range
                            var colinfo_min = theFetcher.addFetchColumn(folder, 'Summ', summaryValue.propid + "_min");//get the min value from the fetcher
                            var colinfo_max = theFetcher.addFetchColumn(folder, 'Summ', summaryValue.propid + "_max");//get the max value from the fetcher
                            var comp_minmax = SummChannel.addComponent(ChannelYVals.YRange(null,//Define the range component
                                theFetcher,               // data fetcher containing the profile information
                                colinfo_min.myID,                       // fetcher column id for the min value
                                colinfo_max.myID,                       // fetcher column id for the max value
                                theColor.changeOpacity(0.25)
                            ), true );

                            //Create the average value profile
                            var colinfo_avg = theFetcher.addFetchColumn(folder, 'Summ', summaryValue.propid + "_avg");//get the avg value from the fetcher
                            var comp_avg = SummChannel.addComponent(ChannelYVals.Comp(null,//Add the profile to the channel
                                theFetcher,               // data fetcher containing the profile information
                                colinfo_avg.myID                        // fetcher column id containing the average profile
                            ), true);
                            comp_avg.setColor(theColor);//set the color of the profile
                            comp_avg.myPlotHints.makeDrawLines(3000000.0); //that causes the points to be connected with lines
                            comp_avg.myPlotHints.interruptLineAtAbsent = true;
                            comp_avg.myPlotHints.drawPoints = false;//only draw lines, no individual points

                            var ctrl_onoff = SummChannel.createVisibilityControl(true);
                            that.visibilityControlsGroup.addControl(ctrl_onoff);

                        }
                    })

                }

                //Map a categorical property to position indicators, color coding a categorical property
                that.createPositionChannel = function(tableInfo, propInfo, controlsGroup, dataFetcher) {
                    var trackid =tableInfo.id+'_'+propInfo.propid;
                    tableInfo.genomeBrowserInfo.currentCustomProperties.push(trackid);
                    var theChannel = ChannelPositions.Channel(trackid,
                        dataFetcher,
                        tableInfo.primkey
                    );
                    theChannel
                        .setTitle(tableInfo.name)
                        .setMaxViewportSizeX(tableInfo.settings.GenomeMaxViewportSizeX);

                    if (propInfo.settings.categoryColors) {
                        var mapping = {};
                        $.each(propInfo.settings.categoryColors, function(key, val) {
                            mapping[key] = DQX.parseColorString(val);
                        });
                        theChannel.makeCategoricalColors(
                            propInfo.propid,
                            mapping
                        );
                    }

                    //Define a custom tooltip
                    theChannel.setToolTipHandler(function(id) { return id; })
                    //Define a function that will be called when the user clicks a snp
                    theChannel.setClickHandler(function(id) {
                        Msg.send({ type: 'ItemPopup' }, { tableid:tableInfo.id, itemid:id } );//Send a message that should trigger showing the snp popup
                    })
                    that.panelBrowser.addChannel(theChannel, false);//Add the channel to the browser
                }

                //Map a numerical property
                that.createPropertyChannel = function(tableInfo, propInfo, controlsGroup, dataFetcher) {
                    var trackid =tableInfo.id+'_'+propInfo.propid;
                    tableInfo.genomeBrowserInfo.currentCustomProperties.push(trackid);
                    if (propInfo.settings.channelName) { // Channel specified -> add to this channel
                        var channelId = propInfo.settings.channelName;
                        var channelName = propInfo.settings.channelName;
                        var inSeparateChannel = false;
                    } else { // No channel specified -> auto create new one
                        var channelId = trackid;
                        var channelName = propInfo.name;
                        var inSeparateChannel = true;
                    }

                    var theChannel = that.channelMap[channelId];
                    if (!theChannel) { // Channel does not yet exist -> create
                        theChannel = ChannelYVals.Channel(trackid,
                            { minVal: propInfo.settings.minval, maxVal: propInfo.settings.maxval } // range
                        );
                        theChannel
                            .setTitle(channelName)
                            .setHeight(150,true)
                            .setChangeYScale(true,true);
                        that.panelBrowser.addChannel(theChannel, false);
                        that.channelMap[channelId] = theChannel;
                        theChannel.controls = Controls.CompoundVert([]);
                        if (propInfo.settings.channelName)
                            theChannel.controls.setLegend(channelName).setAutoFillX(false);
                        controlsGroup.addControl(theChannel.controls);

                        theChannel.getToolTipContent = function(compID, pointIndex) {
                            var itemid = dataFetcher.getColumnPoint(pointIndex, tableInfo.primkey);
                            var pos = dataFetcher.getPosition(pointIndex);
                            var value = dataFetcher.getColumnPoint(pointIndex, compID);
                            return itemid+'<br/>Position= '+pos+'<br/>'+MetaData.findProperty(propInfo.tableid,compID).name+'= '+value.toFixed(4);
                        };
                        theChannel.handlePointClicked = function(compID, pointIndex) {
                            var itemid = dataFetcher.getColumnPoint(pointIndex, tableInfo.primkey);
                            Msg.send({ type: 'ItemPopup' }, { tableid:tableInfo.id, itemid:itemid } );//Send a message that should trigger showing the item popup
                        };
                    }

                    if ((inSeparateChannel) && (MetaData.hasSummaryValue(propInfo.tableid,propInfo.propid))) {
                        // There is a summary value associated to this datatable property, and we add it to this channel
                        var summInfo = MetaData.findSummaryValue(propInfo.tableid,propInfo.propid);
                        summInfo.isDisplayed = true; // Set this flag so that it does not get added twice
                        var theColor = DQX.parseColorString(summInfo.settings.channelColor);;
                        var theFetcher = that.getSummaryFetcher(summInfo.minblocksize);
                        var summFolder = that.summaryFolder+'/'+propInfo.propid;
                        //Create the min-max range
                        var colinfo_min = theFetcher.addFetchColumn(summFolder, 'Summ', propInfo.propid + "_min");
                        var colinfo_max = theFetcher.addFetchColumn(summFolder, 'Summ', propInfo.propid + "_max");
                        var comp_minmax = theChannel.addComponent(ChannelYVals.YRange(null,theFetcher,colinfo_min.myID,colinfo_max.myID,theColor.changeOpacity(0.25)), true );
                        //Create the average value profile
                        var colinfo_avg = theFetcher.addFetchColumn(summFolder, 'Summ', propInfo.propid + "_avg");//get the avg value from the fetcher
                        var comp_avg = theChannel.addComponent(ChannelYVals.Comp(null,theFetcher,colinfo_avg.myID), true);
                        comp_avg.setColor(theColor);//set the color of the profile
                        comp_avg.myPlotHints.makeDrawLines(3000000.0); //that causes the points to be connected with lines
                        comp_avg.myPlotHints.interruptLineAtAbsent = true;
                        comp_avg.myPlotHints.drawPoints = false;//only draw lines, no individual points
                    }

                    var plotcomp = theChannel.addComponent(ChannelYVals.Comp(null, dataFetcher, propInfo.propid), true);//Create the component
                    plotcomp.myPlotHints.pointStyle = 1;//chose a sensible way of plotting the points
                    plotcomp.myPlotHints.color = DQX.parseColorString(propInfo.settings.channelColor);
                    plotcomp.setMaxViewportSizeX(tableInfo.settings.GenomeMaxViewportSizeX);
                    if (propInfo.settings.connectLines)
                        plotcomp.myPlotHints.makeDrawLines(1.0e99);
                    var label = propInfo.name;
                    if (!plotcomp.myPlotHints.color.isBlack())
                        label = '&nbsp;<span style="background-color:{cl}">&nbsp;&nbsp;</span>&nbsp;'.DQXformat({cl:plotcomp.myPlotHints.color.toString()}) + label;
                    if (inSeparateChannel) {
                        var ctrl_onoff = theChannel.createVisibilityControl(true);
                    }
                    else {
                        var ctrl_onoff = theChannel.createComponentVisibilityControl(propInfo.propid, label, false, true);
                    }
                    theChannel.controls.addControl(ctrl_onoff);
                }


                that.reLoad = function() {
                    if (that.uptodate)
                        return;
                    that.uptodate = true;

                    if (that.visibilityControlsGroup)
                        that.visibilityControlsGroup.clear();

                    that.channelMap = {};

                    if (that.listDataFetcherProfiles) {
                        $.each(that.listDataFetcherProfiles, function(idx,fetcher) {
                            that.panelBrowser.delDataFetcher(fetcher);
                        });
                    }

                    if (that.listSummaryChannels) {
                        $.each(that.listSummaryChannels, function(idx, channelid) {
                            that.panelBrowser.delChannel(channelid);
                        })
                    }

                    that.listDataFetcherProfiles = [];
                    that.listSummaryChannels = [];

                    that.summaryFolder = 'SummaryTracks/' + MetaData.database;

                    // Loop over all datatables that contain genomic positions
                    $.each(MetaData.mapTableCatalog,function(tableid,tableInfo) {
                        if (tableInfo.hasGenomePositions) {
                            if (tableInfo.genomeBrowserInfo.dataFetcher) {//Remove any existing channels
                                $.each(tableInfo.genomeBrowserInfo.currentCustomProperties,function(idx,propid) {
                                    that.panelBrowser.delChannel(propid);
                                });
                                that.panelBrowser.delDataFetcher(tableInfo.genomeBrowserInfo.dataFetcher);
                            }

                            var controlsGroup = Controls.CompoundVert([]).setLegend('<h3>'+tableInfo.name+'</h3>');
                            that.visibilityControlsGroup.addControl(controlsGroup);

                            that.ctrl_filtertype = Controls.Combo(null, { label:'Filter method: ', states:[{id:'all', name:'All'}, {id:'query', name:'Currently query'}], value:'all'}).setClassID('filteronoff').setOnChanged(function() {
                                tableInfo.genomeBrowserInfo.filterByQuery = (that.ctrl_filtertype.getValue()=='query');
                                if (tableInfo.genomeBrowserInfo.filterByQuery)
                                    tableInfo.genomeBrowserInfo.dataFetcher.setUserQuery2(tableInfo.currentQuery);
                                else
                                    tableInfo.genomeBrowserInfo.dataFetcher.setUserQuery2(SQL.WhereClause.Trivial());
                                that.panelBrowser.render();
                            });
                            controlsGroup.addControl(that.ctrl_filtertype);
                            controlsGroup.addControl(Controls.VerticalSeparator(12));

                            //Initialise the data fetcher that will download the data for the table
                            var dataFetcher = new DataFetchers.Curve(
                                MetaData.serverUrl,
                                MetaData.database,
                                tableInfo.id + 'CMB_' + MetaData.workspaceid
                            );
                            dataFetcher.setMaxViewportSizeX(tableInfo.settings.GenomeMaxViewportSizeX);

                            tableInfo.genomeBrowserInfo.dataFetcher = dataFetcher;
                            dataFetcher.addFetchColumnActive(tableInfo.primkey, "String");//add id column to the datafetcher, not plotted but needed for the tooltip & click actions

                            if (tableInfo.genomeBrowserInfo.filterByQuery)
                                dataFetcher.setUserQuery2(tableInfo.currentQuery);

                            //Loop over all datatable properties, and add those that are declared to be displayed in the genome browser
                            tableInfo.genomeBrowserInfo.currentCustomProperties = [];
                            $.each(MetaData.customProperties,function(idx,propInfo) {
                                if ((propInfo.tableid==tableInfo.id) && (propInfo.isFloat) && (propInfo.settings.showInBrowser)) {
                                    that.createPropertyChannel(tableInfo, propInfo, controlsGroup, dataFetcher);
                                }
                                if ((propInfo.tableid==tableInfo.id) && (propInfo.isText) && (propInfo.settings.showInBrowser)) {
                                    that.createPositionChannel(tableInfo, propInfo, controlsGroup, dataFetcher);
                                }
                            });
                        }

                    });


                    that.tableBasedSummaryValue_Add = function(tableid, trackid, recordid) {
                        var summaryValue = MetaData.getTableInfo(tableid).mapTableBasedSummaryValues[trackid];
                        var channelid=trackid+'_'+recordid;
                        if (that.panelBrowser.findChannel(channelid)) {
                            //Already exists - simply make visible
                            that.panelBrowser.findChannelRequired(channelid).modifyVisibility(true, true);
                        }
                        else {
                            //Does not exist - create
                            var theFetcher = that.getSummaryFetcher(summaryValue.minblocksize);

                            var folder=that.summaryFolder+'/TableTracks/'+tableid+'/'+trackid+'/'+recordid;

                            var SummChannel = ChannelYVals.Channel(channelid, { minVal: summaryValue.minval, maxVal: summaryValue.maxval });//Create the channel
                            SummChannel
                                .setTitle(channelid).setHeight(120, true)
                                .setChangeYScale(true,true);//makes the scale adjustable by dragging it
                            SummChannel.controls = Controls.CompoundVert([]);
                            SummChannel.fromTable_tableid = tableid;
                            SummChannel.fromTable_trackid = trackid;
                            SummChannel.fromTable_trackid = trackid;
                            SummChannel.fromTable_recordid = recordid;
                            SummChannel.setSubTitle(summaryValue.trackname);
                            SummChannel.setOnClickHandler(function() {
                                Msg.send({ type: 'ItemPopup' }, { tableid: tableid, itemid: recordid } );
                            });

                            that.panelBrowser.addChannel(SummChannel);//Add the channel to the browser
                            that.channelMap[channelid] = SummChannel;

                            var theColor = DQX.parseColorString(summaryValue.settings.channelColor);;

                            //Create the min-max range
                            var colinfo_min = theFetcher.addFetchColumn(folder, 'Summ', channelid + "_min");//get the min value from the fetcher
                            var colinfo_max = theFetcher.addFetchColumn(folder, 'Summ', channelid + "_max");//get the max value from the fetcher
                            var comp_minmax = SummChannel.addComponent(ChannelYVals.YRange(null,//Define the range component
                                theFetcher,               // data fetcher containing the profile information
                                colinfo_min.myID,                       // fetcher column id for the min value
                                colinfo_max.myID,                       // fetcher column id for the max value
                                theColor.changeOpacity(0.25)
                            ), true );

                            //Create the average value profile
                            var colinfo_avg = theFetcher.addFetchColumn(folder, 'Summ', channelid + "_avg");//get the avg value from the fetcher
                            var comp_avg = SummChannel.addComponent(ChannelYVals.Comp(null,//Add the profile to the channel
                                theFetcher,               // data fetcher containing the profile information
                                colinfo_avg.myID                        // fetcher column id containing the average profile
                            ), true);
                            comp_avg.setColor(theColor);//set the color of the profile
                            comp_avg.myPlotHints.makeDrawLines(3000000.0); //that causes the points to be connected with lines
                            comp_avg.myPlotHints.interruptLineAtAbsent = true;
                            comp_avg.myPlotHints.drawPoints = false;//only draw lines, no individual points
                        }
                    };

                    // For a specific datatable, (re)builds all the tracks that correspond to that datatable records
                    that.rebuildTableBasedSummaryValues = function(tableid) {
                        var tableInfo=MetaData.getTableInfo(tableid);

                        //remove tracks that are not visible anymore
                        var presentMap = {};
                        var toDeleteList = [];
                        $.each(that.panelBrowser.getChannelList(), function(idx, channel) {
                            if (channel.fromTable_tableid==tableid) {
                                if (channel.getVisible()) {
                                    if ( (!tableInfo.mapTableBasedSummaryValues[channel.fromTable_trackid].isVisible) ||
                                         (!tableInfo.genomeTrackSelectionManager.isItemSelected(channel.fromTable_recordid)) ) {
                                        channel.modifyVisibility(false, true);
                                        toDeleteList.push(channel.getID());
                                    }
                                }
                                presentMap[channel.fromTable_trackid+'_'+channel.fromTable_recordid]=channel.getVisible();
                            }
                        });
                        $.each(toDeleteList, function(idx,channelid) {
                            that.panelBrowser.delChannel(channelid);
                        });

                        //Add new tracks
                        $.each(tableInfo.genomeTrackSelectionManager.getSelectedList(), function(idx, recordid) {
                            $.each(tableInfo.tableBasedSummaryValues, function(idx2, summaryValue) {
                                if (summaryValue.isVisible) {
                                    if (!presentMap[summaryValue.trackid+'_'+recordid])
                                        that.tableBasedSummaryValue_Add(tableid, summaryValue.trackid, recordid);
                                }
                            });
                        });

                        //!!! todo: automatically sort the tablesummary tracks according to a meaningful criterion

                        that.panelBrowser.handleResize();
                        that.updateTableBasedSummaryValueHeaders();
                    };

                    // Updates the header information for datatable-related genome tracks
                    that.updateTableBasedSummaryValueHeaders = function() {
                        $.each(that.panelBrowser.getChannelList(), function(idx,channel) {
                             if (channel.fromTable_tableid) {
                                 var tableInfo = MetaData.getTableInfo(channel.fromTable_tableid);
                                 var activePropID = tableInfo.genomeBrowserFieldChoice.getValue();//obtain the property id that is currently used to create the header line
                                 var value = tableInfo.fieldCache.getField(channel.fromTable_recordid, activePropID);
                                 channel.setTitle(value);
                                 var tooltip = '';
                                 $.each(tableInfo.quickFindFields, function(idx, propid) {
                                     tooltip += '<b>'+MetaData.findProperty(tableInfo.id,propid).name+': </b>';
                                     tooltip += tableInfo.fieldCache.getField(channel.fromTable_recordid, propid);
                                     tooltip += '<br/>';
                                 });

                                 channel.setHeaderTooltip(tooltip);
                             }
                        });
                        that.panelBrowser.render();
                    }



                    that.createSummaryChannels();

                    this.panelControls.render();

                    that.panelBrowser.handleResize();
                    //if (MetaData.chromosomes.length>0)
                    that.panelBrowser.setChromosome(MetaData.chromosomes[0].id,true,true);

                }




                return that;
            }

        };

        return GenomeBrowserModule;
    });