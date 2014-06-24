# This file is part of Panoptes - (C) Copyright 2014, Paul Vauterin, Ben Jeffery, Alistair Miles <info@cggh.org>
# This program is free software licensed under the GNU Affero General Public License.
# You can find a copy of this license in LICENSE in the top directory of the source code or at <http://opensource.org/licenses/AGPL-3.0>

import os
import DQXDbTools
import DQXUtils
import config
import SettingsLoader
import ImpUtils
import LoadTable
import shutil
import customresponders.panoptesserver.Utils as Utils


tableOrder = 0

def ImportDataTable(calculationObject, datasetId, tableid, folder, importSettings):
    global tableOrder
    with calculationObject.LogHeader('Importing datatable {0}'.format(tableid)):
        print('Source: ' + folder)
        DQXUtils.CheckValidTableIdentifier(tableid)

        calculationObject.credentialInfo.VerifyCanDo(DQXDbTools.DbOperationWrite(datasetId, 'tablecatalog'))
        calculationObject.credentialInfo.VerifyCanDo(DQXDbTools.DbOperationWrite(datasetId, 'propertycatalog'))
        calculationObject.credentialInfo.VerifyCanDo(DQXDbTools.DbOperationWrite(datasetId, 'relations'))
        calculationObject.credentialInfo.VerifyCanDo(DQXDbTools.DbOperationWrite(datasetId, 'tablebasedsummaryvalues'))

        tableSettings = SettingsLoader.SettingsLoader(os.path.join(os.path.join(folder, 'settings')))
        tableSettings.RequireTokens(['NameSingle', 'NamePlural', 'PrimKey'])
        tableSettings.AddTokenIfMissing('IsPositionOnGenome', False)
        tableSettings.AddTokenIfMissing('IsRegionOnGenome', False)
        tableSettings.AddTokenIfMissing('MaxTableSize', None)
        tableSettings.AddTokenIfMissing('MaxCountQueryRecords', 200000)
        tableSettings.AddTokenIfMissing('MaxCountQueryAggregated', 1000000)
        tableSettings.AddTokenIfMissing('AllowSubSampling', False)
        extraSettings = tableSettings.Clone()
        extraSettings.DropTokens(['PrimKey', 'Properties'])

        if tableSettings['MaxTableSize'] is not None:
            print('WARNING: table size limited to '+str(tableSettings['MaxTableSize']))

        # Drop existing tablecatalog record
        sql = "DELETE FROM tablecatalog WHERE id='{0}'".format(tableid)
        ImpUtils.ExecuteSQL(calculationObject, datasetId, sql)

        # Add to tablecatalog
        extraSettings.ConvertStringsToSafeSQL()
        sql = "INSERT INTO tablecatalog VALUES ('{0}', '{1}', '{2}', {3}, '{4}', {5})".format(
            tableid,
            tableSettings['NamePlural'],
            tableSettings['PrimKey'],
            tableSettings['IsPositionOnGenome'],
            extraSettings.ToJSON(),
            tableOrder
        )
        ImpUtils.ExecuteSQL(calculationObject, datasetId, sql)
        tableOrder += 1

        properties = ImpUtils.LoadPropertyInfo(calculationObject, tableSettings, os.path.join(folder, 'data'))

        sql = "DELETE FROM propertycatalog WHERE tableid='{0}'".format(tableid)
        ImpUtils.ExecuteSQL(calculationObject, datasetId, sql)
        sql = "DELETE FROM relations WHERE childtableid='{0}'".format(tableid)
        ImpUtils.ExecuteSQL(calculationObject, datasetId, sql)

        ranknr = 0
        for property in properties:
            propid = property['propid']
            settings = property['Settings']
            extraSettings = settings.Clone()
            extraSettings.DropTokens(['Name', 'DataType', 'Order'])
            sql = "INSERT INTO propertycatalog VALUES ('', 'fixed', '{0}', '{1}', '{2}', '{3}', {4}, '{5}')".format(
                settings['DataType'],
                propid,
                tableid,
                settings['Name'],
                0,
                extraSettings.ToJSON()
            )
            ImpUtils.ExecuteSQL(calculationObject, datasetId, sql)
            if settings.HasToken('Relation'):
                relationSettings = settings.GetSubSettings('Relation')
                calculationObject.Log('Creating relation: '+relationSettings.ToJSON())
                relationSettings.RequireTokens(['TableId'])
                relationSettings.AddTokenIfMissing('ForwardName', 'belongs to')
                relationSettings.AddTokenIfMissing('ReverseName', 'has')
                sql = "INSERT INTO relations VALUES ('{0}', '{1}', '{2}', '{3}', '{4}', '{5}')".format(
                    tableid,
                    propid,
                    relationSettings['TableId'],
                    '',
                    relationSettings['ForwardName'],
                    relationSettings['ReverseName']
                )
                ImpUtils.ExecuteSQL(calculationObject, datasetId, sql)
            ranknr += 1



        propidList = []
        propDict = {}
        for property in properties:
            propDict[property['propid']] = property
            propidList.append(property['propid'])

        if tableSettings['IsPositionOnGenome']:
            if not tableSettings.HasToken('Chromosome'):
                raise Exception('Missing settings tag Chromosome in genome position datatable.')
            if not tableSettings.HasToken('Position'):
                raise Exception('Missing settings tag Position in genome position datatable.')
            if tableSettings['Chromosome'] not in propDict:
                 raise Exception('Genome position datatable {0} is missing property "{1}"'.format(tableid, tableSettings['Chromosome']))
            if tableSettings['Position'] not in propDict:
                 raise Exception('Genome position datatable {0} is missing property "{1}"'.format(tableid, tableSettings['Position']))

        if tableSettings['IsRegionOnGenome']:
            if not tableSettings.HasToken('Chromosome'):
                raise Exception('Missing setting "Chromosome" in genome region datatable {0}'.format(tableid))
            if not tableSettings.HasToken('RegionStart'):
                raise Exception('Missing setting "RegionStart" in genome region datatable {0}'.format(tableid))
            if not tableSettings.HasToken('RegionStop'):
                raise Exception('Missing setting "RegionStop" in genome region datatable {0}'.format(tableid))
            if tableSettings['Chromosome'] not in propDict:
                 raise Exception('Genome region datatable {0} is missing property "{1}"'.format(tableid, tableSettings['Chromosome']))
            if tableSettings['RegionStart'] not in propDict:
                 raise Exception('Genome region datatable {0} is missing property "{1}"'.format(tableid, tableSettings['RegionStart']))
            if tableSettings['RegionStop'] not in propDict:
                 raise Exception('Genome region datatable {0} is missing property "{1}"'.format(tableid, tableSettings['RegionStop']))
            propDict[tableSettings['Chromosome']]['Settings'].SetToken('Index', True)
            propDict[tableSettings['RegionStart']]['Settings'].SetToken('Index', True)
            propDict[tableSettings['RegionStop']]['Settings'].SetToken('Index', True)


        if not importSettings['ConfigOnly']:
            columns = [ {
                            'name': prop['propid'],
                            'DataType': prop['DataType'],
                            'Index': prop['Settings']['Index'],
                            'ReadData': prop['Settings']['ReadData']
                        }
                        for prop in properties if (prop['propid'] != 'AutoKey')]
            LoadTable.LoadTable(
                calculationObject,
                os.path.join(folder, 'data'),
                datasetId,
                tableid,
                columns,
                tableSettings,
                importSettings,
                tableSettings['AllowSubSampling']
            )
            if tableSettings['IsPositionOnGenome']:
                calculationObject.Log('Indexing chromosome')
                scr = ImpUtils.SQLScript(calculationObject)
                scr.AddCommand('create index {0}_chrompos ON {0}({1},{2})'.format(
                    tableid,
                    tableSettings['Chromosome'],
                    tableSettings['Position']
                ))
                scr.Execute(datasetId)



        print('Creating summary values')
        sql = "DELETE FROM summaryvalues WHERE tableid='{0}'".format(tableid)
        ImpUtils.ExecuteSQL(calculationObject, datasetId, sql)
        for property in properties:
            propid = property['propid']
            settings = property['Settings']

            if (settings.HasToken('SummaryValues')) and ImpUtils.IsValueDataTypeIdenfifier(property['DataType']):
                with calculationObject.LogHeader('Creating numerical summary values for {0}.{1}'.format(tableid,propid)):
                    summSettings = settings.GetSubSettings('SummaryValues')
                    if settings.HasToken('minval'):
                        summSettings.AddTokenIfMissing('MinVal', settings['minval'])
                    if settings.HasToken('maxval'):
                        summSettings.AddTokenIfMissing('MaxVal', settings['maxval'])
                    sourceFileName = os.path.join(folder, 'data')
                    destFolder = os.path.join(config.BASEDIR, 'SummaryTracks', datasetId, propid)
                    if not os.path.exists(destFolder):
                        os.makedirs(destFolder)
                    dataFileName = os.path.join(destFolder, propid)
                    if not importSettings['ConfigOnly']:
                        ImpUtils.ExtractColumns(calculationObject, sourceFileName, dataFileName, [tableSettings['Chromosome'], tableSettings['Position'], propid], False, importSettings)
                    ImpUtils.CreateSummaryValues_Value(
                        calculationObject,
                        summSettings,
                        datasetId,
                        tableid,
                        'fixed',
                        '',
                        propid,
                        settings['Name'],
                        dataFileName,
                        importSettings
                    )

            if (settings.HasToken('SummaryValues')) and (property['DataType'] == 'Text'):
                with calculationObject.LogHeader('Creating categorical summary values for {0}.{1}'.format(tableid,propid)):
                    summSettings = settings.GetSubSettings('SummaryValues')
                    sourceFileName = os.path.join(folder, 'data')
                    destFolder = os.path.join(config.BASEDIR, 'SummaryTracks', datasetId, propid)
                    if not os.path.exists(destFolder):
                        os.makedirs(destFolder)
                    dataFileName = os.path.join(destFolder, propid)
                    if not importSettings['ConfigOnly']:
                        ImpUtils.ExtractColumns(calculationObject, sourceFileName, dataFileName, [tableSettings['Chromosome'], tableSettings['Position'], propid], False, importSettings)
                    categories = []
                    if settings.HasToken('categoryColors'):
                        stt = settings.GetSubSettings('categoryColors')
                        categories = [x for x in stt.Get()]
                        summSettings.AddTokenIfMissing('Categories', categories)
                    ImpUtils.CreateSummaryValues_Categorical(
                        calculationObject,
                        summSettings,
                        datasetId,
                        tableid,
                        'fixed',
                        '',
                        propid,
                        settings['Name'],
                        dataFileName,
                        importSettings
                    )

        sql = "DELETE FROM tablebasedsummaryvalues WHERE tableid='{0}'".format(tableid)
        ImpUtils.ExecuteSQL(calculationObject, datasetId, sql)

        if tableSettings.HasToken('TableBasedSummaryValues'):
            calculationObject.Log('Processing table-based summary values')
            if not type(tableSettings['TableBasedSummaryValues']) is list:
                raise Exception('TableBasedSummaryValues token should be a list')
            for stt in tableSettings['TableBasedSummaryValues']:
                summSettings = SettingsLoader.SettingsLoader()
                summSettings.LoadDict(stt)
                summSettings.RequireTokens(['Id', 'Name', 'MaxVal', 'BlockSizeMax'])
                summSettings.AddTokenIfMissing('MinVal', 0)
                summSettings.AddTokenIfMissing('BlockSizeMin', 1)
                summSettings.DefineKnownTokens(['channelColor'])
                summaryid = summSettings['Id']
                with calculationObject.LogHeader('Table based summary value {0}, {1}'.format(tableid, summaryid)):
                    extraSummSettings = summSettings.Clone()
                    extraSummSettings.DropTokens(['Id', 'Name', 'MinVal', 'MaxVal', 'BlockSizeMin', 'BlockSizeMax'])
                    sql = "INSERT INTO tablebasedsummaryvalues VALUES ('{0}', '{1}', '{2}', '{3}', {4}, {5}, {6}, 0)".format(
                        tableid,
                        summaryid,
                        summSettings['Name'],
                        extraSummSettings.ToJSON(),
                        summSettings['MinVal'],
                        summSettings['MaxVal'],
                        summSettings['BlockSizeMin']
                    )
                    ImpUtils.ExecuteSQL(calculationObject, datasetId, sql)
                    if importSettings['ScopeStr'] == 'all':
                        itemtracknr = 0
                        for fileid in os.listdir(os.path.join(folder, summaryid)):
                            if not(os.path.isdir(os.path.join(folder, summaryid, fileid))):
                                itemtracknr += 1
                                calculationObject.Log('Processing {0}: {1}'.format(itemtracknr, fileid))
                                destFolder = os.path.join(config.BASEDIR, 'SummaryTracks', datasetId, 'TableTracks', tableid, summaryid, fileid)
                                calculationObject.Log('Destination: '+destFolder)
                                if not os.path.exists(destFolder):
                                    os.makedirs(destFolder)
                                shutil.copyfile(os.path.join(folder, summaryid, fileid), os.path.join(destFolder, summaryid+'_'+fileid))
                                ImpUtils.ExecuteFilterbankSummary_Value(calculationObject, destFolder, summaryid+'_'+fileid, summSettings)





