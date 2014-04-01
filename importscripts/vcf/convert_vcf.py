import collections
import os
import vcfnp
import errno
from compiler.ast import flatten
import numpy


def mkdir_p(path):
    try:
        os.makedirs(path)
    except OSError as exc: # Python >2.5
        if exc.errno == errno.EEXIST and os.path.isdir(path):
            pass
        else: raise

vcf_file = "ag1000g.phase1.AR1.Y_unplaced.PASS.vcf.gz"

print 'Parsing variants'
variants = vcfnp.itervariants(vcf_file)

#Recursivly get the names of the columns
def names_from_dtype(dtype, path=''):
    if dtype.names:
        #dtypes don't support iter.... yes. I know.
        dtype_as_list = [dtype[i] for i in xrange(len(dtype))]
        return [names_from_dtype(inner_dtype, path+'.'+name if path else name)
                for name, inner_dtype in zip(dtype.names, dtype_as_list)]
    elif dtype.kind == 'V': #a vector with no names! We will have to just number them...
        return [path+'.'+str(i) if path else str(i) for i in range(dtype.shape[0])]
    else:
        return path

def flatten_numpy_line(line):
    for entry in line:
        if type(entry) == numpy.void or type(entry) == numpy.ndarray:
            for sub_entry in flatten_numpy_line(entry):
                yield sub_entry
        else:
            yield entry


mkdir_p('panoptes_ready_vcf_data/datatables/variants')
out_file = 'panoptes_ready_vcf_data/datatables/variants/data'
with open(out_file, 'w') as f:
    f.write('\t'.join(flatten(names_from_dtype(variants.dtype))))
    f.write('\n')
    for line in variants:
        f.write('\t'.join(map(str, flatten_numpy_line(line))))
        f.write('\n')

print 'Parsing variants'
c = vcfnp.calldata_2d('ag1000g.phase1.AR1.Y_unplaced.PASS.vcf.gz', fields=['DP', 'GT'])


variants_out = out.create_dataset("variant_index", variants.shape, 'S12', maxshape=variants.shape, compression='gzip', fletcher32=False, shuffle=False)
#Fill woth chrom pos?

depth_out = out.create_dataset("total_depth", depth.shape, depth.dtype, chunks=(1000,depth.shape[1]/4), maxshape=depth.shape, compression='szip', fletcher32=False, shuffle=False)
genotype = f['calldata_2d']['genotype']
first_allele = out.create_dataset("first_allele", genotype.shape, 'i1', chunks=(2000,depth.shape[1]/4), maxshape=genotype.shape, compression='szip', fletcher32=False, shuffle=False)
#Parse "a/b"
copy(genotype, first_allele, lambda array,: map(lambda inner: map(itemgetter(0), inner), array))
second_allele = out.create_dataset("second_allele", genotype.shape, 'i1', chunks=(2000,depth.shape[1]/4), maxshape=genotype.shape, compression='szip', fletcher32=False, shuffle=False)
copy(genotype, second_allele, lambda array,: map(lambda inner: map(itemgetter(1), inner), array))


# mkdir_p('panoptes_ready_vcf_data/datatables/samples')
# out_file = 'panoptes_ready_vcf_data/datatables/samples'
# with open(out_file, 'w') as f:
#     f.write('\t'.join(flatten(names_from_dtype(variants.dtype))))
#     f.write('\n')
#     for line in variants:
#         f.write('\t'.join(map(str, flatten_numpy_line(line))))
#         f.write('\n')







