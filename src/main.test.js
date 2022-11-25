const search = require('./script');

test('erwarten das ', () => {
    expect(search("tractor+accidents").toBe(1))
})