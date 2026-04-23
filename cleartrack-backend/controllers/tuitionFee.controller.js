const TuitionFee = require('../models/TuitionFee');

// @desc  Get all tuition fees
// @route GET /api/tuition-fees
const getAllFees = async (req, res) => {
  try {
    const fees = await TuitionFee.find();
    res.json({ success: true, fees });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Update or create tuition fee for a year
// @route POST /api/tuition-fees/update
const updateFee = async (req, res) => {
  try {
    const { year, meritReg, meritFull, tfw, nri } = req.body;
    
    let feeStructure = await TuitionFee.findOne({ year });
    
    if (feeStructure) {
      feeStructure.meritReg = meritReg;
      feeStructure.meritFull = meritFull;
      feeStructure.tfw = tfw;
      feeStructure.nri = nri;
      await feeStructure.save();
    } else {
      feeStructure = await TuitionFee.create({ year, meritReg, meritFull, tfw, nri });
    }
    
    res.json({ success: true, feeStructure });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = { getAllFees, updateFee };
