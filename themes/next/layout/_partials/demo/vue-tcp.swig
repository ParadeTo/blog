<div id="vue-tcp">
  <header id="header">
    <div class="sec">
      <div id="timer">
        <div :style="'width:' + client.time + '%;'"></div>
      </div>
    </div>
    <div class="sec">
      <button @click="onAllPause" v-html="isPause ? 'Resume' : 'Pause'"></button>
    </div>
    <div class="sec">
      <p>
        缓存大小：<input type='range' min='1' max='15' v-model='server.maxRcvBuffer'/>
      </p>
      <p>
        窗口大小：<input type='range' min='1' :max="server.maxRcvBuffer" v-model='maxWindow' />
      </p>
    </div>
  </header>
  <main id="main">
    <section id="client">
      <h2>client</h2>
      <p class="btns">
        <button @click="onSend">Send</button>
      </p>
      <ul class="packs">
        <span class="window" :style="'height:' + 35 * window + 'px;' + 'top:' + client.lastByteAcked * 35 + 'px'"></span>
        <span id="lastByteAcked" class="arrow" :style="'top:' + 35 * client.lastByteAcked + 'px'">lastByteAcked</span>
        <span id="lastByteSent" class="arrow" :style="'top:' + 35 * client.lastByteSent + 'px'">lastByteSent</span>
        <li v-for="p in client.packs" v-key="p.seq" v-html="p.seq" :class="{'pack': true,'sent': p.status.client >= 1}"></li>
      </ul>
    </section>
    <section id="path">
      <div v-for="p in sendingPacks" v-key="p.seq" class='sending-pack' :style="'transform: translate('+p.x+'px,'+p.seq*pathPackSize+'px)'">
        <p class='operation'>
          <span class='down' @click='onDown(p)'></span>
          <span class='up' @click='onUp(p)'></span>
          <!--<span class='pause' ></span>-->
          <span class='remove' @click='onRemove(p)'></span>
        </p>
        <p v-html="p.seq"></p>
      </div>
      <div v-for="p in ackingPacks" v-key="p.ack" class='acking-pack' :style="'transform: translate('+p.x+'px,'+(p.ack-1)*pathPackSize+'px)'">
        <p class='operation'>
          <span class='down' @click='onUp(p)'></span>
          <span class='up' @click='onDown(p)'></span>
          <!--<span class='pause' ></span>-->
          <span class='remove' @click='onRemove(p, true)'></span>
        </p>
        <p v-html="p.ack"></p>
      </div>
    </section>
    <section id="server">
      <h2>server</h2>
      <p class="btns">
        <button @click="onRead">Read</button>
      </p>
      <ul class="packs">
        <span class="rcv-buffer" :style="'height:' + 35 * server.maxRcvBuffer + 'px;' + 'top:' + server.lastByteRead * 35 + 'px'"></span>
        <span class="window" :style="'height:' + 35 * window + 'px;' + 'top:' + (server.nextByteExpected - 1) * 35 + 'px'"></span>
        <span id="lastByteRead" class="arrow" :style="'top:' + 35 * server.lastByteRead + 'px'">lastByteRead</span>
        <span id="nextByteExpected" class="arrow" :style="'top:' + 35 * (server.nextByteExpected - 1) + 'px'">nextByteExpected</span>
        <li v-for="p in client.packs" v-key="p.seq" v-html="p.seq" :class="{'server-pack': true, 'received': p.status.server === 1, 'readed': p.status.server === 2}"></li>
      </ul>
    </section>
  </main>
</div>