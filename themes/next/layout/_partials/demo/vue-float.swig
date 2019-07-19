<div id="vue-float">
  <h1>浮点数转换</h1>
  <div id="feedback">Bug反馈及问题交流: youxingzhi@qq.com</div>
  <div>
    <input type="number" id="input" placeholder="输入要转换的数字" v-model="number" />
    <input type="radio" name="type" value="float" id="float" v-model="type">
    <label for="float">float</label>
    <input type="radio" name="type" value="double" id="double" v-model="type">
    <label for="double">double</label>
    <button id="start" @click="start">开始</button>
  </div>
  <div id="integer" v-if="integerSteps.length > 0 && number !== '0'">
    <h2>整数部分二进制表示（余数从右到左）</h2>
    <table>
      <tr>
        <td>算式</td>
        <td v-for="step in integerSteps" v-html="step.dividend + ' / ' + 2 "></td>
      </tr>
      <tr>
        <td>商</td>
        <td v-for="step in integerSteps" v-html="step.quotient"></td>
      </tr>
      <tr>
        <td>余数</td>
        <td v-for="step in integerSteps" v-html="step.remainder"></td>
      </tr>
    </table>
  </div>
  <div id="decimals" v-if="decimalsSteps.length > 0 && number !== '0'">
    <h2>小数部分二进制表示（当前位从左到右）</h2>
    <table>
      <tr>
        <td>算式</td>
        <td v-for="(step, i) in decimalsSteps" v-html="step.decimals + ' &times; ' + 2 "></td>
      </tr>
      <tr>
        <td align="center">当前位（小于1为0，否则为1）</td>
        <td v-for="(step, i) in decimalsSteps" v-html="step.bit"></td>
      </tr>
      <tr>
        <td>剩余</td>
        <td v-for="(step, i) in decimalsSteps" v-html="step.remainder"></td>
      </tr>
    </table>
  </div>
  <div id="integerAndDecimals" v-if="f && number !== '0'">
    <h2>二进制表示</h2>
    <div v-html="binaryStr"></div>
  </div>
  <div id="integerAndDecimals" v-if="f && number !== '0'">
    <h2>二进制表示（科学计数法）</h2>
    <div v-html="'1.' + f + '&times;' + '2^(' + originE + ')'"></div>
  </div>
  <div id="integerAndDecimals" v-if="f">
    <h2>浮点数三要素</h2>
    <table>
      <tr>
        <td>s</td>
        <td v-html="s"></td>
      </tr>
      <tr>
        <td>f</td>
        <td v-html="f"></td>
      </tr>
      <tr>
        <td>e</td>
        <td v-if="number !== '0'" v-html="originE + ' + 127 = ' + (originE + 127) + ' = ' + e"></td>
        <td v-else v-html="originE"></td>
      </tr>
    </table>
  </div>
  <div id="integerAndDecimals" v-if="f">
    <h2>浮点数二进制示意图</h2>
    <div id="bits">
      <span class="bit sign" v-html="s"></span>
      <span class="bit e" v-for="_e in e" v-html="_e"></span>
      <span class="bit" v-for="_f in f" v-html="_f"></span>
    </div>
  </div>
</div>