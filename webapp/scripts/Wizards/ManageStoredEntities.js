define(["require", "DQX/base64", "DQX/Application", "DQX/Framework", "DQX/FrameList", "DQX/Controls", "DQX/Msg", "DQX/SQL", "DQX/DocEl", "DQX/Utils", "DQX/Wizard", "DQX/Popup", "DQX/PopupFrame", "DQX/FrameCanvas", "DQX/DataFetcher/DataFetchers", "Wizards/EditQuery", "MetaData"],
    function (require, base64, Application, Framework, FrameList, Controls, Msg, SQL, DocEl, DQX, Wizard, Popup, PopupFrame, FrameCanvas, DataFetchers, EditQuery, MetaData) {

        var ManageStoredEntities = {};





        ManageStoredEntities.manage = function(tablename, nameSingle, namePlural, newValue) {
            var that = PopupFrame.PopupFrame('ManageEntity_'+tablename, {title:'Manage '+namePlural, blocking:true, sizeX:400, sizeY:350 });

            that.createFrames = function() {
                that.frameRoot.makeGroupVert();
                that.frameList = that.frameRoot.addMemberFrame(Framework.FrameFinal('', 0.7))
                    .setAllowScrollBars(true,true);
                that.frameButtons = that.frameRoot.addMemberFrame(Framework.FrameFinal('', 0.3))
                    .setFixedSize(Framework.dimY, 70).setFrameClassClient('DQXGrayClient');
            };

            that.createPanels = function() {

                that.panelList = FrameList(that.frameList);

                that.reload();

                var bt_add = Controls.Button(null, { buttonClass: 'DQXWizardButton', content: 'Add current...' }).setOnChanged(that.onAdd);
                var bt_del = Controls.Button(null, { buttonClass: 'DQXWizardButton', content: 'Delete selected' }).setOnChanged(that.onDel);

                that.panelButtons = Framework.Form(that.frameButtons);

                var bt_close = Controls.Button(null, { buttonClass: 'DQXWizardButton', content: 'Close', bitmap: DQX.BMP('ok.png'), width:80, height:25 }).setOnChanged(function() {
                    that.close();
                });

                that.panelButtons.addControl(Controls.CompoundHor([
                    Controls.HorizontalSeparator(7),
                    bt_add,
                    bt_del
                ]));
                that.panelButtons.addControl(Controls.AlignRight(Controls.CompoundHor([
                    bt_close,
                    Controls.HorizontalSeparator(7)
                ])));

            };


            that.reload = function() {
                var getter = DataFetchers.ServerDataGetter();
                getter.addTable(
                    'storedqueries',
                    ['id','name'],
                    'name',
                    SQL.WhereClause.CompareFixed('workspaceid','=',MetaData.workspaceid)
                );
                getter.execute(MetaData.serverUrl, MetaData.database, function() {
                    var data = getter.getTableRecords('storedqueries');
                    var items = [];
                    $.each(data, function(idx, record) {
                        items.push({id:record.id, content:record.name});
                    });
                    that.panelList.setItems(items);
                    that.panelList.render();
                });
            };


            that.onDel = function() {
                var id = that.panelList.getActiveItem();
                if (id) {
                    if (window.confirm("Remove "+nameSingle+'?')) {
                        DQX.customRequest(MetaData.serverUrl, 'uploadtracks', 'delstoredentity',
                            {
                                database: MetaData.database,
                                tablename: tablename,
                                id: id
                            }
                            , function() {
                                that.reload();
                            });
                    }
                }
            };


            that.onAdd = function() {
                var name = prompt("Please enter a name for the "+nameSingle,"");

                if (name != null) {
                    DQX.customRequest(MetaData.serverUrl, 'uploadtracks', 'addstoredentity',
                        {
                            database: MetaData.database,
                            tablename: tablename,
                            workspaceid: MetaData.workspaceid,
                            name: name,
                            content: newValue
                        }
                        , function(resp) {
                        that.reload();
                    });
                }
            }

            that.create();

            return that;
        }



        return ManageStoredEntities;
    });

