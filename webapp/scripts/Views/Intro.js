// This file is part of Panoptes - (C) Copyright 2014, Paul Vauterin, Ben Jeffery, Alistair Miles <info@cggh.org>
// This program is free software licensed under the GNU Affero General Public License. 
// You can find a copy of this license in LICENSE in the top directory of the source code or at <http://opensource.org/licenses/AGPL-3.0>
define(["require", "DQX/base64", "DQX/Msg", "DQX/Application", "DQX/Framework", "DQX/Controls", "DQX/Msg", "DQX/Popup", "DQX/DocEl", "DQX/Utils", "DQX/FrameTree", "DQX/FrameList", "DQX/DataFetcher/DataFetchers", "DQX/SQL", "MetaData", "Utils/IntroViews", "Wizards/FindGene"],
    function (require, Base64, Msg, Application, Framework, Controls, Msg, Popup, DocEl, DQX, FrameTree, FrameList, DataFetchers, SQL, MetaData, IntroViews, FindGene) {

        ////////////// Utilities for async server communication in case of lengthy operations



        var IntroModule = {

            init: function () {
                // Instantiate the view object
                var that = Application.View(
                    'start',        // View ID
                    'Start page'    // View title
                );

                //This function is called during the initialisation. Create the frame structure of the view here
                that.createFrames = function(rootFrame) {
                    rootFrame.makeGroupHor();
                    rootFrame.setSeparatorSize(7);

                    this.frameButtons2 = rootFrame.addMemberFrame(Framework.FrameFinal('', 0.6));
                    this.frameButtons = rootFrame.addMemberFrame(Framework.FrameFinal('', 0.4))/*.setFixedSize(Framework.dimX, 400)*/;
                    this.frameButtons.setMargins(0);
                    this.frameButtons2.setMargins(0);
                    //this.frameCalculations = rootFrame.addMemberFrame(Framework.FrameFinal('', 0.5)).setDisplayTitle("Server calculations");
                }

                // This function is called during the initialisation. Create the panels that will populate the frames here
                that.createPanels = function() {
                    this.panelButtons = Framework.Form(this.frameButtons);
                    this.panelButtons.setPadding(0);
                    this.panelButtons2 = Framework.Form(this.frameButtons2);
                    this.panelButtons2.setPadding(0);

                    //this.panelChannels = FrameTree.Tree(this.frameChannels);
                    //that.updateChannelInfo();

                    var miscButtonList = [];

                    var tableButtons = [];

                    if (MetaData.generalSettings.hasGenomeBrowser) {
                        var browserButton = Application.getView('genomebrowser').createActivationButton({
                            content: "Genome browser",
                            buttonClass: "DQXToolButton2",
                            bitmap: 'Bitmaps/GenomeBrowserSmall.png'
                        });
//                        var findGeneButton = Application.getView('genomebrowser').createActivationButton({
//                            content: "Fine gene...",
//                            buttonClass: "DQXToolButton1",
//                            bitmap: 'Bitmaps/Find.png'
//                        });

                        var findGeneButton = Controls.Button(null,
                            {
                                buttonClass: 'DQXToolButton1',
                                content: "Find gene...",
                                icon: 'fa-search',
                                width:100, height:35
                            });
                        findGeneButton.setOnChanged(function() {
                            FindGene.execute()
                        })

                        //miscButtonList.push(browserButton);

                        var descr = MetaData.generalSettings.GenomeBrowserDescr||'<i>No description</i>';

                        var grp = Controls.CompoundVert([
                            Controls.Static(descr),
                            Controls.CompoundHor([browserButton, findGeneButton])
//                            browserButton
                        ]);
                        tableButtons.push(Controls.Section(grp, {
                            title: "Genome browser",
                            headerStyleClass: 'GenomeBrowserMainSectionHeader',
                            bodyStyleClass: 'ControlsSectionBodyIntro',
                            canCollapse: false
                        }));

                    }

                    $.each(MetaData.tableCatalog, function(idx, tableInfo) {
                        var tableViewerButton = Application.getView('table_'+tableInfo.id).createActivationButton({
                            content: "Show table",
                            icon: 'fa-table'
                        });

                        var button_Showplots = Controls.Button(null, {content: 'Create plot...', buttonClass: 'DQXToolButton2', width:100, height:35, icon:'fa-bar-chart-o'}).setOnChanged(function() {
                            Msg.send({type: 'CreateDataItemPlot'}, { query: null , tableid: tableInfo.id });
                        });

                        var descr = '';
//                        descr += tableInfo.createIcon({floatLeft: true});
                        descr += tableInfo.settings.Description||'<i>No description</i>';
//                        if ((tableInfo.relationsChildOf.length>0) || (tableInfo.relationsParentOf.length>0)) {
//                            descr += '<br><br><div style="color:rgb(128,128,128);margin-left:15px"><b>Relations:</b>'
//                            $.each(tableInfo.relationsChildOf, function(idx, relationInfo) {
//                                descr += '<br>A ' + tableInfo.tableNameSingle + ' <i>' + relationInfo.forwardname+'</i> a '+MetaData.mapTableCatalog[relationInfo.parenttableid].tableNameSingle;
//                            });
//                            $.each(tableInfo.relationsParentOf, function(idx, relationInfo) {
//                                descr += '<br>A ' + tableInfo.tableNameSingle + ' <i>' + relationInfo.reversename+'</i> '+MetaData.mapTableCatalog[relationInfo.childtableid].tableNamePlural;
//                            });
//                            descr += '</div>';
//                        }
                        var info = Controls.Static(descr);
                        var grp = Controls.CompoundVert([
                            Controls.CompoundHor([
                                Controls.Static(tableInfo.createIcon({floatLeft: false})),
                                Controls.HorizontalSeparator(18),
                                Controls.CompoundVert([
                                    Controls.VerticalSeparator(4),
                                    Controls.CompoundHor([
                                        tableViewerButton,
                                        button_Showplots
                                    ])
                                ]).setTreatAsBlock().setMargin(0)
                            ]),
                            info,
                            Controls.Static('')
                        ]);;
                        tableButtons.push(Controls.Section(grp, {
                            title: tableInfo.tableCapNamePlural,
                            headerStyleClass: 'GenomeBrowserMainSectionHeader',
                            bodyStyleClass: 'ControlsSectionBodyIntro',
                            canCollapse: false
                        }));
                    })



                    this.panelButtons.addControl(Controls.CompoundVert([
                        Controls.CompoundVert(tableButtons)
                    ]));

                    that.storedViews = Controls.Html(null,'', '___');

                    this.panelButtons2.addControl(Controls.CompoundVert([
                        //Controls.Static('<small>Workspace ID: '+MetaData.workspaceid+'</small>')
                        Controls.Wrapper(
                            Controls.CompoundVert([
                                Controls.Static('<div style="font-weight:bold;font-size:17px;">'+MetaData.generalSettings.Name+'</div><p>'),
                                Controls.Static(MetaData.generalSettings.Description||'<i>No description</i>'),
                                //Controls.VerticalSeparator(20),
                                //Controls.CompoundVert(miscButtonList).setTreatAsBlock(),
                                //Controls.VerticalSeparator(5)
                            ]).setMargin(0)
                            ,'IntroPanelInfo'),
                        that.storedViews
                    ])).setMargin(0);

                    Msg.listen('', {type: 'LoadIntroViews'}, function() {
                        IntroViews.loadIntroViews();
                    });

                    IntroViews.setContainer(that.storedViews);
                    IntroViews.loadIntroViews();


                }



                return that;
            }

        };

        return IntroModule;
    });