# This file is part of Panoptes - (C) Copyright 2014, Paul Vauterin, Ben Jeffery, Alistair Miles <info@cggh.org>
# This program is free software licensed under the GNU Affero General Public License.
# You can find a copy of this license in LICENSE in the top directory of the source code or at <http://opensource.org/licenses/AGPL-3.0>

import DQXDbTools
import DQXUtils
import asyncresponder
import os
import config
import Utils
from DQXDbTools import DBCOLESC
from DQXDbTools import DBTBESC


def ResponseExecute(returndata, calculationObject):

    databaseName = DQXDbTools.ToSafeIdentifier(returndata['database'])
    workspaceid = DQXDbTools.ToSafeIdentifier(returndata['workspaceid'])
    tableid = DQXDbTools.ToSafeIdentifier(returndata['tableid'])
    keyid = DQXDbTools.ToSafeIdentifier(returndata['keyid'])
    isNumericalKey = int(DQXDbTools.ToSafeIdentifier(returndata['isnumericalkey'])) > 0
    dataid = DQXDbTools.ToSafeIdentifier(returndata['dataid'])
    subsetid = DQXDbTools.ToSafeIdentifier(returndata['subsetid'])
    method = DQXDbTools.ToSafeIdentifier(returndata['method'])

    if method not in ['add', 'replace']:
        raise Exception('Invalid store selection method')

    calculationObject.Log('==== storing subset')

    filename = os.path.join(config.BASEDIR, 'temp', 'store_'+dataid)
    with open(filename, 'r') as fp:
        datastring = fp.read()
    os.remove(filename)

    if not(isNumericalKey):
        valuesString = '("{0}", {1})'
    else:
        valuesString = '({0}, {1})'
    subsetTable = tableid + '_subsets'



    with DQXDbTools.DBCursor(calculationObject.credentialInfo, databaseName) as cur:
        cur.credentials.VerifyCanDo(DQXDbTools.DbOperationWrite(databaseName, 'storedsubsets'))
        # sqlstring = 'INSERT INTO {0} VALUES ()'.format(DBTBESC(tableName), DBCOLESC(propid))
        # cur.execute(sqlstring)
        # cur.commit()

        if method == 'replace':
            cur.execute('DELETE FROM {0} WHERE subsetid={1}'.format(DBTBESC(subsetTable), subsetid))
            cur.commit()

        existingRecordMap = {}
        if method == 'add':
            calculationObject.Log('Determining current subset content...')
            cur.execute('SELECT {0} FROM {1} WHERE subsetid={2}'.format(DBCOLESC(keyid), DBTBESC(subsetTable), subsetid))
            for row in cur.fetchall():
                existingRecordMap[row[0]] = True

        if len(datastring) > 0:
            keys = datastring.split('\t')
            def submitkeys(keylist):
                if len(keylist) > 0:
                    sqlstring = "INSERT INTO {0} VALUES ".format(DBTBESC(subsetTable))
                    sqlstring += ', '.join([valuesString.format(key, subsetid) for key in keylist])
#                    print(sqlstring)
                    cur.execute(sqlstring)
                    cur.commit()
            keysublist = []
            keyNr = 0
            for key in keys:
                if key not in existingRecordMap:
                    keysublist.append(key)
                    if len(keysublist) >= 500:
                        submitkeys(keysublist)
                        keysublist = []
                        calculationObject.SetInfo('Storing', keyNr*1.0/len(keys))
                        calculationObject.Log('Stored {0} items'.format(keyNr))
                    keyNr += 1
            submitkeys(keysublist)




def response(returndata):
    retval = asyncresponder.RespondAsync(
        ResponseExecute,
        returndata,
        "Store subset"
    )
    return retval
