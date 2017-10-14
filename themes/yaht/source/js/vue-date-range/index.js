function isMobile() {
  var sUserAgent = navigator.userAgent.toLowerCase();

  var bIsIpad = /ipad/i.test(sUserAgent);
  var bIsIphoneOs = /iphone os/i.test(sUserAgent);
  var bIsMidp = /midp/i.test(sUserAgent);
  var bIsUc7 = /rv:1.2.3.4/i.test(sUserAgent);
  var bIsUc = /ucweb/i.test(sUserAgent);
  var bIsAndroid = /android/i.test(sUserAgent);
  var bIsCE = /windows ce/i.test(sUserAgent);
  var bIsWM = /windows mobile/i.test(sUserAgent);
  var bIsWx = /MicroMessenger/i.test(sUserAgent);
  if (bIsIpad || bIsIphoneOs || bIsMidp || bIsUc7 || bIsUc || bIsAndroid || bIsCE || bIsWM || bIsWx) {
    return true;
  }
  return false;
}

Vue.component('datepicker', {
  template: '<div class="date-picker">'+
  '<div class="mask" v-show="showCalendar" @click.stop="showCalendar=false"></div>'+
  '<div class="field">'+
  '<p class="control">'+
  '<input type="text" class="input" :value="display" readonly @focus="showCalendar = true">'+
  '</p>'+
  '</div>'+
  '<div class="calendar-wrapper" v-show="showCalendar">'+
  '<calendar @change="onChange" v-if="!isDateRange" lang="en"></calendar>'+
  '<daterange @change="onChange" lang="en" v-else></daterange>'+
  '</div>'+
  '</div>',
  components: {
    'daterange': daterange.DateRange,
    'calendar': daterange.Calendar
  },
  props: {
    isDateRange: {
      type: Boolean,
      default: false
    },
    defaultDateRange: {
      type: Object
    },
    defaultDate: {
      type: Object
    }
  },
  data () {
    return {
      showCalendar: false,
      dateRange: this.defaultDateRange,
      date: this.defaultDate
    }
  },
  computed: {
    display: function() {
      if (this.isDateRange && this.dateRange) {
        return `${this.dateRange.startDate.format('YYYY-MM-DD')}~${this.dateRange.endDate.format('YYYY-MM-DD')}`
      }
      return this.date && this.date.format('YYYY-MM-DD')
    }
  },
  methods: {
    onChange: function (obj) {
      console.log(obj)
      if (obj.startDate) {
        this.dateRange = {
          startDate: obj.startDate,
          endDate: obj.endDate
        }
        this.$emit('daterangechange', {startDate: obj.startDate, endDate: obj.endDate})
      } else {
        this.date = obj
        this.$emit('datechange', this.date)
      }
    }
  }
})

new Vue({
  el: '#app',
  components: {
    'daterange': daterange.DateRange,
    'calendar': daterange.Calendar
  },
  data() {
    return {
      date: moment().format('YYYY-MM-DD'),
      isMobile: isMobile(),
      emitChangeOnStep0: false,
      showCalendar: true,
      showLunar: true,
      disableDaysBeforeToday: true,
      daysDisabledStart: null,
      daysDisabledEnd: null,
      defaultDate: null,
      defaultRange: null,
      firstDayOfWeek: 0,
      lang: 'zh',
      monthYearFormat: 'MM - YYYY'
    };
  },
  watch: {
    disableDaysBeforeToday: function () {
      this.resetComp()
    },
    firstDayOfWeek: function () {
      this.resetComp()
    },
    lang: function () {
      this.resetComp()
    },
    daysDisabledStart: function () {
      this.resetComp()
    },
    daysDisabledEnd: function () {
      this.resetComp()
    },
    defaultDate: function () {
      this.resetComp()
    },
    defaultRange: function () {
      this.resetComp()
    }
  },
  methods: {
    resetComp: function () {
      var vm = this
      this.showCalendar = !this.showCalendar
      this.$nextTick(function () {
        vm.showCalendar = !vm.showCalendar
      })
    },
    onChange: function (data) {
      if (data.startDate) {
        this.date = data.startDate.format('YYYY-MM-DD') + '~' + data.endDate.format('YYYY-MM-DD')
      } else {
        this.date = data.format('YYYY-MM-DD')
      }
    },
    daysDisabledStartChange: function (data) {
      this.daysDisabledStart = data
    },
    daysDisabledEndChange: function (data) {
      this.daysDisabledEnd = data
    },
    defaultDateChange: function (data) {
      this.defaultDate = data
    },
    defaultRangeChange: function (data) {
      this.defaultRange = data
    },
  }
});