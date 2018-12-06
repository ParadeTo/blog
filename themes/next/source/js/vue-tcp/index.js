function animate ({from, to, duration, callback, isPause = false}) {
  duration = duration || 300
  function easingFunc (t, b, c, d) {
    return c * t / d + b
  }

  let start = 0
  let goBack = false
  let auto = true
  let isDestroy = false
  var during = Math.ceil(duration / 17) // the number of frame

  function fire () {
    let delta = 1
    if (!auto) delta = 3
    if (goBack) delta *= -1
    start += delta
    if (start < 0) start = 0
    const value = easingFunc(start, from, to - from, during)
    if (start <= during) {
      callback(value)
      auto && window.requestAnimationFrame(step)
    } else {
      callback(to, true)
    }
  }

  var step = function () {
    if (isPause || isDestroy) return
    fire()
  }

  !isPause && !isDestroy && step()
  return {
    pause: function () {
      isPause = true
    },
    resume: function () {
      auto = true
      goBack = false
      isPause = false
      step()
    },
    destroy: function () {
      isDestroy = true
    },
    isDestroy: function () {
      return isDestroy
    },
    isPause: function () {
      return isPause
    },
    nextStep: function () {
      auto = false
      goBack = false
      fire()
    },
    lastStep: function () {
      auto = false
      goBack = true
      fire()
    }
  }
}

function removeItemInArr (arr, item, isSame = (a, b) => a.seq === b.seq) {
  for (let i = 0; i < arr.length; i++) {
    if (isSame(arr[i], item)) {
      arr.splice(i, 1)
    }
  }
}

// eslint-disable-next-line
new Vue({
  el: '#vue-tcp',
  data () {
    const packs = []
    for (let i = 0; i < 15; i++) {
      packs.push({
        seq: i + 1,
        /**
          client:
          0：未发送
          1：已发送未确认
          2：已发送已确认
          server:
          0：未收到
          1：已收到
          2：已收到已确认
         */
        status: {
          client: 0,
          server: 0
        },
        x: 0
      })
    }

    return {
      ott: 3000, // one trip time
      pathPackSize: 50,
      client: {
        timer: null,
        time: 0,
        packs: packs,
        lastByteAcked: 0,
        lastByteSent: 0
      },
      sendingPacks: [],
      ackingPacks: [],
      window: 4,
      maxWindow: 4,
      server: {
        packs: packs,
        lastByteRead: 0,
        nextByteExpected: 1,
        maxRcvBuffer: 4
      },
      isPause: false
    }
  },
  created: function () {
    this.animateList = []
  },
  mounted: function () {
    this.pathWidth = document.querySelector('#path').offsetWidth
  },
  watch: {
    maxWindow: function (val) {
      this.window = val
      console.log(val)
    }
  },
  methods: {
    onUp: function (p) {
      p.animate.nextStep()
    },
    onDown: function (p) {
      p.animate.lastStep()
    },
    onRemove: function (p, ack = false) {
      removeItemInArr(ack ? this.ackingPacks : this.sendingPacks, p)
      p.animate.destroy()
    },
    onSend: function () {
      if (this.client.lastByteSent - this.client.lastByteAcked >= this.window) return
      const pack = this.client.packs[this.client.lastByteSent++]
      this.send(pack)
      this.setTimer()
    },
    onRead: function () {
      const pack = this.server.packs[this.server.lastByteRead]
      if (pack.status.server !== 1) return
      this.server.lastByteRead++
      pack.status.server = 2
      this.setWindow()
    },
    send: function (pack) {
      pack.status.client = 1
      this.sendingPacks.push(pack)
      this.animateSendingPack(pack)
    },
    reSend: function () {
      // resend the last acked pack's seq + 1
      for (let i = 0, len = this.client.packs.length; i < len; i++) {
        const p = this.client.packs[i]
        if (p.status.client === 1 && p.seq === this.client.lastByteAcked + 1) {
          this.send(p)
          this.setTimer()
          break
        }
      }
    },
    onAllPause: function () {
      this.isPause = !this.isPause
      if (this.isPause) {
        this.animateList.forEach(a => {
          if (a.isDestroy()) a = null
          else a.pause()
        })
      } else {
        this.animateList.forEach(a => {
          if (a.isDestroy()) a = null
          else a.resume()
        })
      }
    },
    onPauseOrResume: function (p) {
      p.animate.pause()
    },
    getAckPack: function () {
      let nextByteExpected = 0
      for (let i = 0, len = this.server.packs.length; i < len; i++) {
        const pack = this.server.packs[i]
        if (pack.status.server === 0) {
          nextByteExpected = pack.seq
          break
        }
      }
      return {
        ack: nextByteExpected,
        x: this.pathWidth - this.pathPackSize
      }
    },
    onSending: function (value, done, pack) {
      pack.x = value
      if (done) { // server receive pack
        pack.status.server = 1
        pack.animate.destroy()
        removeItemInArr(this.sendingPacks, pack)

        const ackPack = this.getAckPack()
        this.ackingPacks.push(ackPack)
        this.animateAckingPack(ackPack)

        this.setNextByteExpected()
        this.setWindow()
      }
    },
    onAcking: function (value, done, pack) {
      pack.x = value
      if (done) { // client receive ack pack from server
        this.client.lastByteAcked = this.client.lastByteAcked > pack.ack - 1 ? this.client.lastByteAcked : pack.ack - 1
        this.client.packs.forEach(p => {
          if (p.seq <= pack.seq) {
            p.status.server = 2
          }
        })
        removeItemInArr(this.ackingPacks, pack)
      }
    },
    setNextByteExpected () {
      for (let i = 0, len = this.server.packs.length; i < len; i++) {
        const p = this.server.packs[i]
        if (p.status.server === 0) {
          this.server.nextByteExpected = p.seq
          break
        }
      }
    },
    setWindow () {
      const remain = this.server.maxRcvBuffer - this.server.nextByteExpected + this.server.lastByteRead + 1
      // debugger
      // if (this.window > remain || this.window === 0) {
      this.window = remain > this.maxWindow ? this.maxWindow : remain
      // }
    },
    animateAckingPack: function (pack) {
      const vm = this
      const animateObj = animate({
        from: this.pathWidth - vm.pathPackSize,
        to: 0,
        duration: vm.ott,
        isPause: this.isPause,
        callback: function (value, done) {
          vm.onAcking(value, done, pack)
        }
      })
      pack.animate = animateObj
      this.animateList.push(animateObj)
    },
    animateSendingPack: function (pack) {
      const vm = this
      const animateObj = animate({
        from: 0,
        to: this.pathWidth - vm.pathPackSize,
        duration: vm.ott,
        isPause: this.isPause,
        callback: function (value, done) {
          vm.onSending(value, done, pack)
        }
      })
      pack.animate = animateObj
      this.animateList.push(animateObj)
    },
    setTimer: function () {
      const vm = this
      if (this.timer) this.timer.destroy()
      this.timer = animate({
        from: 0,
        to: 2 * this.ott + 1000,
        duration: 2 * this.ott + 1000,
        isPause: this.isPause,
        callback: function (value, done) {
          vm.client.time = value / (2 * vm.ott + 1000) * 100
          if (done) { // time out
            vm.reSend() // select and resend
          }
        }
      })
      this.animateList.push(this.timer)
    }
  }
})
