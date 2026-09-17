function getInclusivePrice(price, sgst, cgst) {
    const totalGst = sgst + cgst;
    return Number((price + (price * totalGst / 100)).toFixed(2));
}

module.exports = { getInclusivePrice };
