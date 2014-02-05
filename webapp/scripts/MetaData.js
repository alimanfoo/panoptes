define(["DQX/Utils", "DQX/Controls", "DQX/Msg", "DQX/Popup"],
    function (DQX, Controls, Msg, Popup) {

        PnServerModule = 'uploadtracks';

        var MetaData = {};

        MetaData.quickLoad = true;
        MetaData.updateCalculationInfo = false;


        //MetaData.serverUrl="http://localhost:8000/app01";
        //MetaData.serverUrl="http://localhost/DQXServer/app";
        MetaData.serverUrl=serverUrl;

        //////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //Data source tables
        //////////////////////////////////////////////////////////////////////////////////////////////////////////////

        //theMetaData1.database = 'pf21c';
        //MetaData.database = 'pf30viewtracks';
        MetaData.tableAnnotation = 'annotation'; //Genome annotation

        //////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //Define the metadata that is generated by the client (NOTE: some of this stuff should move to the server)
        //////////////////////////////////////////////////////////////////////////////////////////////////////////////

        /*
        MetaData.summaryFolder='Tracks-PfPopGen2.1';//Location of the summary data, relative to the base path defined by DQXServer
        MetaData.summaryConfig='Summ01';//ID of the summary configuration used


        //List of all the summary profiles displayed in the app
        MetaData.summaryProfiles=[
            { id:'GC300', name:"%GC" },
            { id:'Uniqueness', name:"Uniqueness" }
        ];
        */

        MetaData.hasTable = function(tableid) {
            if (!MetaData.mapTableCatalog)
                DQX.reportError('Table info not yet available');
            return !!MetaData.mapTableCatalog[tableid];
        }

        MetaData.getTableInfo = function(tableid) {
            if (!MetaData.mapTableCatalog)
                DQX.reportError('Table info not yet available');
            if (!MetaData.mapTableCatalog[tableid])
                DQX.reportError('Could not find table '+tableid);
            return MetaData.mapTableCatalog[tableid];
        }

        // Empty placeholders: this info has not been obtained yet
        MetaData.customProperties = [];

        MetaData.findProperty = function(tableid, propid) {
            var rs = null;
            $.each(MetaData.customProperties, function(idx, propInfo) {
                if ((propInfo.tableid==tableid) && (propInfo.propid==propid))
                    rs =  propInfo;
            });
            if (rs!=null) return rs;
            DQX.reportError('Property {prop} not found for table {table}'.DQXformat({prop:propid, table: tableid}));
        }

        MetaData.hasProperty = function(tableid, propid) {
            var isPresent = false;
            $.each(MetaData.customProperties, function(idx, propInfo) {
                if ((propInfo.tableid==tableid) && (propInfo.propid==propid))
                    isPresent = true;
            });
            return isPresent;
        }


        MetaData.findSummaryValue = function(tableid, propid) {
            var rs = null;
            $.each(MetaData.summaryValues, function(idx, propInfo) {
                if ((propInfo.tableid==tableid) && (propInfo.propid==propid))
                    rs =  propInfo;
            });
            if (rs!=null) return rs;
            DQX.reportError('Summary value {prop} not found for table {table}'.DQXformat({prop:propid, table: tableid}));
        }

        MetaData.hasSummaryValue = function(tableid, propid) {
            var isPresent = false;
            $.each(MetaData.summaryValues, function(idx, propInfo) {
                if ((propInfo.tableid==tableid) && (propInfo.propid==propid))
                    isPresent = true;
            });
            return isPresent;
        }


        return MetaData;
    });
