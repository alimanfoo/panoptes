# This file is part of Panoptes - (C) Copyright 2014, Paul Vauterin, Ben Jeffery, Alistair Miles <info@cggh.org>
# This program is free software licensed under the GNU Affero General Public License.
# You can find a copy of this license in LICENSE in the top directory of the source code or at <http://opensource.org/licenses/AGPL-3.0>

import os
from DQXTableUtils import VTTable
import ImpUtils
import datetime
import dateutil.parser
from DQXDbTools import DBCOLESC
from DQXDbTools import DBTBESC
from DQXDbTools import DBDBESC


# Columns: list of dict
#       name
#       DataType: Value, Boolean, Text

def LoadTable(calculationObject, sourceFileName, databaseid, tableid, columns, loadSettings, importSettings, allowSubSampling):

    def EncodeCell(icontent, col):
        content = icontent
        if col['IsString']:
            if len(icontent) == 0:
                content = "''"
            else:
                try:
                    content = content.encode('ascii', 'ignore')
                except UnicodeDecodeError:
                    print('Unable to encode '+content)
                    content='*failed encoding*'
                content = content.replace("\x92", "'")
                content = content.replace("\xC2", "'")
                content = content.replace("\x91", "'")
                #filter(lambda x: x in string.printable, val)
                content = content.replace("'", "\\'")
                content = content.replace('\r\n', '\\n')
                content = content.replace('\n\r', '\\n')
                content = '\'' + content + '\''

        if col['IsValue']:
            if (content == 'NA') or (content == '') or (content == 'None') or (content == 'NULL') or (content == 'null') or (content == 'inf') or (content == '-'):
                content = 'NULL'

        if col['IsDate']:
            if len(content)>=5:
                try:
                    dt = dateutil.parser.parse(content)
                    tmdiff  =(dt - datetime.datetime(1970, 1, 1)).days
                    tmdiff += 2440587.5 +0.5 # note: extra 0.5 because we set datestamp at noon
                    content = str(tmdiff)
                except:
                    print('ERROR: date parsing string '+content)
                    content = 'NULL'
            else:
                content = 'NULL'

        if col['IsBoolean']:
            vl = content
            content = 'NULL'
            if (vl.lower() == 'true') or (vl.lower() == 'yes') or (vl.lower() == 'y') or (vl == '1'):
                content = '1'
            if (vl.lower() == 'false') or (vl.lower() == 'no') or (vl.lower() == 'n') or (vl == '0'):
                content = '0'

        return content

    calculationObject.Log('Loading table {0} from {1}'.format(tableid, sourceFileName))
    colDict = {col['name']: col for col in columns}
    colNameList = [col['name'] for col in columns]
    primkey = loadSettings['PrimKey']
    autoPrimKey = (primkey == 'AutoKey')
    print('Column info: ' + str(columns))
    print('Primary key: ' + primkey)

    for col in columns:
        col['IsString'] = (col['DataType'] == 'Text')
        col['IsValue'] = ImpUtils.IsValueDataTypeIdenfifier(col['DataType'])
        col['IsDate'] = ImpUtils.IsDateDataTypeIdenfifier(col['DataType'])
        col['IsBoolean'] = (col['DataType'] == 'Boolean')
        col['MaxLen'] = 0

    destFileName = ImpUtils.GetTempFileName()

    maxLineCount = -1
    if importSettings['ScopeStr'] == '1k':
        maxLineCount = 1000
    if importSettings['ScopeStr'] == '10k':
        maxLineCount = 10000
    if importSettings['ScopeStr'] == '100k':
        maxLineCount = 100000
    if importSettings['ScopeStr'] == '1M':
        maxLineCount = 1000000
    if importSettings['ScopeStr'] == '10M':
        maxLineCount = 10000000

    with open(sourceFileName, 'r') as ifp:
        if ifp is None:
            raise Exception('Unable to read file '+sourceFileName)
        with open(destFileName, 'w') as ofp:
            if ofp is None:
                raise Exception('Unable to write to temporary file ' + destFileName)
            fileColNames = [colname.replace(' ', '_') for colname in ifp.readline().rstrip('\n\r').split('\t')]
            calculationObject.Log('File columns: ' + str(fileColNames))
            fileColIndex = {fileColNames[i]: i for i in range(len(fileColNames))}
            if not(autoPrimKey) and (primkey not in fileColIndex):
                raise Exception('File is missing primary key '+primkey)
            for col in columns:
                # if 'ReadData' not in col:
                #     print('==========' + str(col))
                colname = col['name']
                if (col['ReadData']) and (colname not in fileColIndex):
                    raise Exception('File is missing column '+colname)

            blockSize = 499
            blockStarted = False

            lineCount = 0
            for line in ifp:
                line = line.rstrip('\r\n')
                if len(line) > 0:
                    sourceCells = line.split('\t')
                    writeCells = []
                    for col in columns:
                        content = 'NULL'
                        if col['name'] in fileColIndex:
                            content = sourceCells[fileColIndex[col['name']]]
                            content = EncodeCell(content, col)
                        writeCells.append(content)
                        if col['IsString']:
                            col['MaxLen'] = max(col['MaxLen'], len(content))

                    if not(blockStarted):
                        ofp.write('INSERT INTO {0} ({1}) VALUES '.format(DBTBESC(tableid), ', '.join([DBCOLESC(col) for col in colNameList])))
                        blockStarted = True
                        blockNr = 0

                    if blockNr > 0:
                        ofp.write(',')
                    ofp.write('(')
                    ofp.write(','.join(writeCells))
                    ofp.write(')')
                    blockNr += 1
                    if blockNr >= blockSize:
                        ofp.write(';\n')
                        blockStarted = False
                    lineCount += 1
                    if lineCount % 250000 == 0:
                        calculationObject.Log('Line '+str(lineCount))
                    if (maxLineCount>0) and (lineCount >= maxLineCount):
                        calculationObject.Log('WARNING:Terminating import at {0} lines'.format(lineCount))
                        break

    calculationObject.Log('Column sizes: '+str({col['name']: col['MaxLen'] for col in columns}))

    calculationObject.Log('Creating schema')
    scr = ImpUtils.SQLScript(calculationObject)
    scr.AddCommand('drop table if exists {0};'.format(DBTBESC(tableid)))
    sql = 'CREATE TABLE {0} (\n'.format(DBTBESC(tableid))
    colTokens = []
    if autoPrimKey:
        colTokens.append("{0} int AUTO_INCREMENT PRIMARY KEY".format(DBCOLESC(primkey)))
    if allowSubSampling:
        colTokens.append("_randomval_ double")
    for col in columns:
        st = DBCOLESC(col['name'])
        typestr = ''
        if col['DataType'] == 'Text':
            typestr = 'varchar({0})'.format(max(1, col['MaxLen']))
        if len(typestr) == 0:
            typestr = ImpUtils.GetSQLDataType(col['DataType'])
        if len(typestr) == 0:
            raise Exception('Invalid property data type ' + col['DataType'])
        st += ' '+typestr
        colTokens.append(st)
    sql += ', '.join(colTokens)
    sql +=')'
    scr.AddCommand(sql)
    calculationObject.Log('Creation statement: '+sql)
    if not(autoPrimKey):
        scr.AddCommand('create unique index {2} ON {0}({1})'.format(
            DBTBESC(tableid),
            DBCOLESC(primkey),
            DBCOLESC(tableid+'_'+primkey)
        ))
    for col in columns:
        if ('Index' in col) and (col['Index']) and (col['name'] != primkey):
            scr.AddCommand('create index {2} ON {0}({1})'.format(
                DBTBESC(tableid),
                DBCOLESC(col['name']),
                DBCOLESC(tableid+'_'+col['name'])
            ))
    scr.Execute(databaseid)

    calculationObject.Log('Importing data')
    ImpUtils.ExecuteSQLScript(calculationObject, destFileName, databaseid)

    if allowSubSampling:
        with calculationObject.LogHeader('Create subsampling table'):
            calculationObject.Log('Creating random data column')
            sql = "UPDATE {0} SET _randomval_=RAND()".format(DBTBESC(tableid))
            ImpUtils.ExecuteSQL(calculationObject, databaseid, sql)
            sql = "CREATE INDEX {1} ON {0}(_randomval_)".format(DBTBESC(tableid), DBCOLESC(tableid+'_randomindex'))
            ImpUtils.ExecuteSQL(calculationObject, databaseid, sql)
            sortRandTable = tableid+'_SORTRAND'
            sql = "DROP TABLE IF EXISTS {0}".format(DBTBESC(sortRandTable))
            ImpUtils.ExecuteSQL(calculationObject, databaseid, sql)
            sql = "CREATE TABLE {1} LIKE {0}".format(DBTBESC(tableid), DBTBESC(sortRandTable))
            ImpUtils.ExecuteSQL(calculationObject, databaseid, sql)
            if autoPrimKey:
                calculationObject.Log('Restructuring AutoKey')
                sql = "alter table {0} drop column AutoKey".format(DBTBESC(sortRandTable))
                ImpUtils.ExecuteSQL(calculationObject, databaseid, sql)
                sql = "alter table {0} add column AutoKey int FIRST".format(DBTBESC(sortRandTable))
                ImpUtils.ExecuteSQL(calculationObject, databaseid, sql)
                sql = "create index idx_autokey on {0}(AutoKey)".format(DBTBESC(sortRandTable))
                ImpUtils.ExecuteSQL(calculationObject, databaseid, sql)
            sql = "alter table {0} add column RandPrimKey int AUTO_INCREMENT PRIMARY KEY".format(DBTBESC(sortRandTable))
            ImpUtils.ExecuteSQL(calculationObject, databaseid, sql)
            sql = "insert into {1} select *,0 from {0} order by _randomval_".format(DBTBESC(tableid), DBTBESC(sortRandTable))
            sql += ' LIMIT 5000000' # NOTE: there is little point in importing more than that!
            ImpUtils.ExecuteSQL(calculationObject, databaseid, sql)

    os.remove(destFileName)

def LoadTable0(calculationObject, sourceFileName, databaseid, tableid, columns, loadSettings):

    calculationObject.Log('Loading table {0} from {1}'.format(tableid, sourceFileName))

    colDict = {col['name']: col for col in columns}
    colNameList = [col['name'] for col in columns]
    print('Column info: '+str(columns))

    tb = VTTable.VTTable()
    tb.allColumnsText = True
    try:
        tb.LoadFile(sourceFileName, loadSettings['MaxTableSize'])
    except Exception as e:
        raise Exception('Error while reading file: '+str(e))
    calculationObject.Log('---- ORIG TABLE ----')
    with calculationObject.LogDataDump():
        tb.PrintRows(0, 9)

    for col in columns:
        if not tb.IsColumnPresent(col['name']):
            raise Exception('Missing column "{0}" in datatable "{1}"'.format(col['name'], tableid))

    if loadSettings['PrimKey'] not in colDict:
        raise Exception('Missing primary key column "{0}" in datatable "{1}"'.format(loadSettings['PrimKey'], tableid))

    for col in tb.GetColList():
        if col not in colDict:
            tb.DropCol(col)
    tb.ArrangeColumns(colNameList)
    for col in columns:
        colname = col['name']
        if ImpUtils.IsValueDataTypeIdenfifier(col['DataType']):
            tb.ConvertColToValue(colname)
        if col['DataType'] == 'Boolean':
            tb.MapCol(colname, ImpUtils.convertToBooleanInt)
            tb.ConvertColToValue(colname)
    calculationObject.Log('---- PROCESSED TABLE ----')
    with calculationObject.LogDataDump():
        tb.PrintRows(0, 9)

    createcmd = 'CREATE TABLE {0} ('.format(DBTBESC(tableid))
    frst = True
    for col in columns:
        if not frst:
            createcmd += ', '
        colname = col['name']
        colnr = tb.GetColNr(colname)
        datatypestr = ''
        if col['DataType'] == 'Text':
            maxlength = 1
            for rownr in tb.GetRowNrRange():
                maxlength = max(maxlength, len(tb.GetValue(rownr, colnr)))
            datatypestr = 'varchar({0})'.format(maxlength)
        if len(datatypestr) == 0:
            datatypestr = ImpUtils.GetSQLDataType(col['DataType'])
        createcmd += DBCOLESC(colname) + ' ' + datatypestr
        frst = False
    createcmd += ')'

    calculationObject.Log('Creating datatable')
    scr = ImpUtils.SQLScript(calculationObject)
    scr.AddCommand('drop table if exists {0}'.format(DBTBESC(tableid)))
    scr.AddCommand(createcmd)
    scr.AddCommand('create unique index {2} ON {0}({1})'.format(
        DBTBESC(tableid),
        DBCOLESC(loadSettings['PrimKey']),
        DBTBESC(tableid+'_primkey')
    ))
    scr.Execute(databaseid)

    calculationObject.Log('Loading datatable values')
    sqlfile = ImpUtils.GetTempFileName()
    tb.SaveSQLDump(sqlfile, tableid)
    ImpUtils.ExecuteSQLScript(calculationObject, sqlfile, databaseid)
    os.remove(sqlfile)
