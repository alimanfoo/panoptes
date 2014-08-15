# This file is part of Panoptes - (C) Copyright 2014, CGGH <info@cggh.org>
# This program is free software licensed under the GNU Affero General Public License.
# You can find a copy of this license in LICENSE in the top directory of the source code or at <http://opensource.org/licenses/AGPL-3.0>

import os
import sys
try:
    import DQXDbTools
except:
    print('Failed to import DQXDbTools. Please add the DQXServer base directory to the Python path')
    sys.exit()
import DQXUtils
import config
import SettingsLoader
import ImpUtils
import customresponders.panoptesserver.Utils as Utils

import ImportDataTable
import Import2DDataTable
import ImportRefGenome
import ImportWorkspaces
import time
import math
from DQXDbTools import DBCOLESC
from DQXDbTools import DBTBESC
from DQXDbTools import DBDBESC



def ImportDataSet(calculationObject, baseFolder, datasetId, importSettings):
    with calculationObject.LogHeader('Importing dataset {0}'.format(datasetId)):
        calculationObject.Log('Import settings: '+str(importSettings))
        DQXUtils.CheckValidDatabaseIdentifier(datasetId)
        datasetFolder = os.path.join(baseFolder, datasetId)
        indexDb = config.DB

        calculationObject.credentialInfo.VerifyCanDo(DQXDbTools.DbOperationWrite(indexDb, 'datasetindex'))
        calculationObject.credentialInfo.VerifyCanDo(DQXDbTools.DbOperationWrite(datasetId))

        # Remove current reference in the index first: if import fails, nothing will show up
        ImpUtils.ExecuteSQL(calculationObject, indexDb, 'DELETE FROM datasetindex WHERE id="{0}"'.format(datasetId))

        globalSettings = SettingsLoader.SettingsLoader(os.path.join(datasetFolder, 'settings'))
        globalSettings.RequireTokens(['Name'])
        globalSettings.AddTokenIfMissing('Description','')

        print('Global settings: '+str(globalSettings.Get()))


        if not importSettings['ConfigOnly']:
            # Dropping existing database
            calculationObject.SetInfo('Dropping database')
            print('Dropping database')
            try:
                ImpUtils.ExecuteSQL(calculationObject, indexDb, 'DROP DATABASE IF EXISTS {0}'.format(DBDBESC(datasetId)))
            except:
                pass
            ImpUtils.ExecuteSQL(calculationObject, indexDb, 'CREATE DATABASE {0}'.format(DBDBESC(datasetId)))

            # Creating new database
            scriptPath = os.path.dirname(os.path.realpath(__file__))
            calculationObject.SetInfo('Creating database')
            print('Creating new database')
            ImpUtils.ExecuteSQLScript(calculationObject, scriptPath + '/createdataset.sql', datasetId)

        ImpUtils.ExecuteSQL(calculationObject, datasetId, 'DELETE FROM propertycatalog')
        ImpUtils.ExecuteSQL(calculationObject, datasetId, 'DELETE FROM summaryvalues')
        ImpUtils.ExecuteSQL(calculationObject, datasetId, 'DELETE FROM tablecatalog')
        ImpUtils.ExecuteSQL(calculationObject, datasetId, 'DELETE FROM settings')
        ImpUtils.ExecuteSQL(calculationObject, datasetId, 'DELETE FROM customdatacatalog')

        datatables = []

        if globalSettings.HasToken('DataTables'):
            if not type(globalSettings['DataTables']) is list:
                raise Exception('DataTables token should be a list')
            datatables = globalSettings['DataTables']

        for dir in os.listdir(os.path.join(datasetFolder,'datatables')):
            if os.path.isdir(os.path.join(datasetFolder, 'datatables', dir)):
                if dir not in datatables:
                    datatables.append(dir)
        print('Data tables: '+str(datatables))
        for datatable in datatables:
            ImportDataTable.ImportDataTable(calculationObject, datasetId, datatable, os.path.join(datasetFolder, 'datatables', datatable), importSettings)

        try:
            datatables_2D = globalSettings['2D_DataTables']
        except KeyError:
            datatables_2D = []
        if type(datatables_2D) is not list:
            raise TypeError('2D_DataTables token should be a list')
        for datatable in datatables_2D:
            Import2DDataTable.ImportDataTable(calculationObject, datasetId, datatable, os.path.join(datasetFolder, '2D_datatables', datatable), importSettings)


        if os.path.exists(os.path.join(datasetFolder, 'refgenome')):
            ImportRefGenome.ImportRefGenome(calculationObject, datasetId, os.path.join(datasetFolder, 'refgenome'), importSettings)
            globalSettings.AddTokenIfMissing('hasGenomeBrowser', True)

        ImportWorkspaces.ImportWorkspaces(calculationObject, datasetFolder, datasetId, importSettings)

        # Global settings
        print('Defining global settings')
        ImpUtils.ImportGlobalSettings(calculationObject, datasetId, globalSettings)

        # Finalise: register dataset
        print('Registering dataset')
        importtime = 0
        if not importSettings['ConfigOnly']:
            importtime = time.time()
        ImpUtils.ExecuteSQL(calculationObject, indexDb, 'INSERT INTO datasetindex VALUES ("{0}", "{1}", "{2}")'.format(
            datasetId,
            globalSettings['Name'],
            str(math.ceil(importtime))
        ))


if __name__ == "__main__":
    import customresponders.panoptesserver.asyncresponder as asyncresponder
    calc = asyncresponder.CalculationThread('', None, {'isRunningLocal': 'True'}, '')

    scopeOptions = ["all", "none", "1k", "10k", "100k"]

    if len(sys.argv) < 4:
        print('Arguments: DataType ImportType DataSetId [...]')
        print('DataType: "dataset", "datatable"')
        print('ImportType: '+', '.join(scopeOptions))
        sys.exit()

    ImportDataType = sys.argv[1]
    if ImportDataType not in ['dataset', 'datatable']:
        print('First argument (DataType) has to be "dataset" or "datatable"')
        sys.exit()

    ImportMethod = sys.argv[2]
    if ImportMethod not in scopeOptions:
        print('Second argument (ImportType) has to be '+', '.join(scopeOptions))
        sys.exit()
    configOnly = (ImportMethod == 'none')

    datasetid = sys.argv[3]

    if ImportDataType == 'dataset':
        print('Start importing dataset "{0}"...'.format(datasetid))
        ImportDataSet(calc, config.SOURCEDATADIR + '/datasets', datasetid,
            {
                'ConfigOnly': configOnly,
                 'ScopeStr': ImportMethod
            }
        )
        sys.exit()

    if ImportDataType == 'datatable':
        if len(sys.argv) < 6:
            print('Missing argument "datatableid"')
            sys.exit()
        datatableid = sys.argv[4]
        print('Start importing datatable "{0}.{1}"...'.format(datasetid, datatableid))
        datatableFolder = os.path.join(config.SOURCEDATADIR, 'datasets', datasetid, 'datatables', datatableid)
        ImportDataTable.ImportDataTable(calc, datasetid, datatableid, datatableFolder,
            {
                'ConfigOnly': configOnly
            }
        )
        sys.exit()

