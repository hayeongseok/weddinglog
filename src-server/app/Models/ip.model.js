module.exports = {
  /**
   * IP형태를 숫자로 변환한다.
   */
  async ip2long(ip) {
    const multipliers = [0x1000000, 0x10000, 0x100, 1];
    let longValue = 0;
    ip.split('.').forEach(function (part, i) {
      longValue += part * multipliers[i];
    });
    return longValue;
  },

  /**
   * 숫자형태를 IP로 변환한다.
   */
  async long2ip(longValue) {
    const multipliers = [0x1000000, 0x10000, 0x100, 1];

    return multipliers
      .map(function (multiplier) {
        return Math.floor((longValue % (multiplier * 0x100)) / multiplier);
      })
      .join('.');
  },
};
