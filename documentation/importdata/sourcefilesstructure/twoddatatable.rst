.. _def-source-twoddatatable:

2D data table source files
~~~~~~~~~~~~~~~~~~~~~~~~~~

In the :ref:`dataset source folder<def-source-dataset>` folder, a subfolder ``2D_datatables`` should be present.
This is the root for a set of folders, each one describing an individual :ref:`2D data table<dataconcept_twoddatatable>`,
with the name of the folder serving as an identifier.

In each *2D data table* folder, a file ``data.hdf5`` should be present, containing the arrays of properties.
(`example file
<https://github.com/cggh/panoptes/blob/master/sampledata/datasets/Genotypes/2D_datatables/genotypes/data.hdf5>`_).

In addition, a yaml ``settings`` file should be present in the *2D data table* folder (see :ref:`def-settings-twoddatatable`).


HDF5 source file structure
..........................
The source file ``data.hdf5`` should be structured according to the
`HDF5 standard <http://www.hdfgroup.org/HDF5/>`_, and may contain the following arrays, which must be contained in the root of the HDF5 file:


Properties arrays
   One or more arrays specifying properties of the 2D data table. Note that these arrays can be 3D but the first two dimensions should be row and column.

Column index 1D array
   A 1D array listing the identifiers of all columns, in the order they are used in the properties matrices.

Row index 1D array
   A 1D array listing the identifiers of all rows, in the order they are used in the properties matrices.

Only scalar builtin dtypes (ie not structured with fields or user-defined) or strings currently permitted for HDF5 arrays.

Example python HDF5 creation code:

.. code:: python

    import h5py
    outfile = h5py.File(filename,'w', libver='latest')
    call = f.create_dataset("call", (1000,10,2), dtype='i8')
    first_allele[:,:,:] = my_array_of_calls
    allele_depth = f.create_dataset("allele_depth", (1000,10,3), dtype='i8')
    allele_depth[:,:,:] = my_array_depth
    quality = f.create_dataset("quality", (1000,10), dtype='i8')
    quality[:,:] = my_array_of_quality
    outfile.close()

We recommend using `VCFNP <https://github.com/alimanfoo/vcfnp>`_ for converting from VCF. See the `VCF example <https://github.com/cggh/panoptes/tree/master/sampledata/datasets/vcf_example>`_ for details of how to do this.


See also
........

- :ref:`dataconcept_datatable`
- :ref:`def-source-data`