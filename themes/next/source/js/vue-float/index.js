// eslint-disable-next-line
// TODO 处理 0.999999999999999999999 这样的数
new Vue({
  el: "#vue-float",
  data() {
    return {
      factor: {
        float: {
          e: 8,
          f: 23,
          offset: 127
        },
        double: {
          e: 11,
          f: 52,
          offset: 1023
        }
      },
      number: "",
      type: "float",
      integerSteps: [],
      integer: "",
      decimalsStepsRedundant: [],
      decimals: ""
    };
  },
  created: function() {},
  mounted: function() {},
  watch: {},
  computed: {
    factorComputed: function() {
      return this.factor[this.type];
    },
    binaryStr: function() {
      return this.integerStr + "." + this.decimalsStr;
    },
    decimalsStepsRedundantStr: function() {
      return this.decimalsStepsRedundant.map(step => step.bit).join("");
    },
    decimalsSteps: function() {
      let len = this.factorComputed.f;
      const first1Idx = this.decimalsStepsRedundantStr.indexOf("1");
      if (this.integerStr.length === 0) {
        len = first1Idx + len + 1;
      }
      // 多看一位来决定需不需要 0 舍 1 入
      const decimalsSteps = this.decimalsStepsRedundant.slice(0, len);
      const decimalsStepsNextNum = this.decimalsStepsRedundant.slice(
        len,
        len + 1
      );
      // 进行0舍1入
      let increment = 0;
      if (decimalsStepsNextNum[0] && decimalsStepsNextNum[0].bit === 1)
        increment = 1;
      this.addOneToDecimalsSteps(decimalsSteps, increment);
      return decimalsSteps;
    },

    binarySciStr: function() {
      const str = this.binaryStr || "";
      const oldPointIdx = str.indexOf(".");
      const newPointIdx = oldPointIdx - this.originE;
      const arr = str.replace(".", "").split("");
      arr.splice(newPointIdx, 0, ".");
      return arr.slice(first1).join("");
    },
    originE: function() {
      if (this.integerSteps.length > 0) return this.integerSteps.length - 1;
      else
        return -(
          this.decimalsSteps.map(step => String(step.bit)).indexOf("1") + 1
        );
    },
    e: function() {
      if (String(this.number) === "0") {
        let str = "";
        for (let i = 0; i < this.factorComputed.e; i++) {
          str += "0";
        }
        return str;
      }
      const e = this.originE + this.factorComputed.offset;
      let eStr = this.computeInteger(e)
        .map(step => step.remainder)
        .reverse()
        .join("");
      for (let i = 0; i < this.factorComputed.e - eStr.length; i++) {
        eStr = "0" + eStr;
      }
      return eStr;
    },
    integerStr: function() {
      return this.integerSteps
        .slice()
        .reverse()
        .map(step => step.remainder)
        .join("");
    },
    decimalsStr: function() {
      return this.decimalsSteps
        .slice()
        .map(step => step.bitAamend)
        .join("");
    },
    f: function() {
      if (String(this.number) === "0") {
        let str = "";
        for (let i = 0; i < this.factorComputed.f; i++) {
          str += "0";
        }
        return str;
      }
      const integerLen = this.integerStr.length;
      if (integerLen > 0) {
        let str = (this.integerStr.substr(1) + this.decimalsStr).slice(
          0,
          this.factorComputed.f
        );
        const strLen = str.length;
        for (let i = 0; i < this.factorComputed.f - strLen; i++) {
          str = str + "0";
        }
        return str;
      } else {
        if (this.decimalsSteps.length > 0) {
          const first1 = this.decimalsStr.indexOf("1");
          return this.decimalsStr.substr(first1 + 1);
        }
      }
      return "";
    },
    s: function() {
      return Number(this.number) < 0 ? 1 : 0;
    }
  },
  methods: {
    addOneToDecimalsSteps(numArr, increment) {
      // 保存进位
      let carry = increment;
      for (let index = numArr.length - 1; index >= 0; index--) {
        res = carry + numArr[index].bit;
        if (res === 0) {
          numArr[index].bitAamend = 0;
          carry = 0;
        } else if (res === 1) {
          numArr[index].bitAamend = 1;
          carry = 0;
        } else if (res === 2) {
          numArr[index].bitAamend = 0;
          carry = 1;
        }
      }
    },
    computeInteger: function(number) {
      const integerSteps = [];
      number = parseInt(Math.abs(number));
      if (Math.abs(number) >= 1) {
        let dividend = number;
        do {
          const quotient = Math.floor(dividend / 2);
          const remainder = dividend - quotient * 2;
          integerSteps.push({
            dividend,
            quotient,
            remainder
          });
          dividend = quotient;
        } while (dividend > 0);
      }
      return integerSteps;
    },

    computeDecimals: function(number) {
      const decimalsSteps = [];
      numberStr = String(Math.abs(number));
      if (numberStr.indexOf(".") > -1) {
        let decimals = parseFloat("." + numberStr.split(".")[1]);
        let i = 0;
        do {
          const product = decimals * 2;
          let bit = 0;
          let remainder = product;
          if (product >= 1) {
            bit = 1;
            remainder = parseFloat("." + String(product).split(".")[1]);
          }
          decimalsSteps.push({
            bit,
            decimals,
            remainder
          });
          decimals = remainder;
        } while (decimals > 0 && ++i < this.factorComputed.f * 2);
      }
      return decimalsSteps;
    },

    start: function() {
      this.integerSteps = this.computeInteger(this.number);
      this.decimalsStepsRedundant = this.computeDecimals(this.number);
    }
  }
});
