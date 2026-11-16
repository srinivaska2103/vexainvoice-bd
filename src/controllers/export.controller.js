const exportService = require('../services/export.service');

const exportSalesExcel = async (req, res, next) => {
  try {
    const { workbook, filename } = await exportService.generateSalesExcelExport(
      req.user.business_id,
      req.user.id,
      req.query
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
};

const exportCustomersExcel = async (req, res, next) => {
  try {
    const { workbook, filename } = await exportService.generateCustomersExcelExport(
      req.user.business_id,
      req.user.id,
      req.query
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  exportSalesExcel,
  exportCustomersExcel
};
