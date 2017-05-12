new Vue({
  el: '#calendar',
  components: {
    'calendar':daterange.Calendar
  },
  data() {
    return {
      disableDaysBeforeToday: true,
      lang: 'en',
      date: moment()
    };
  },
  methods: {
    onChange(date) {
      this.date = date;
    },
    setDate (offset) {
      this.date = moment().add(offset, 'days')
    }
  }
});

new Vue({
  el: '#calendarLunar',
  components: {
    'calendar':daterange.Calendar
  },
  data() {
    return {
      disableDaysBeforeToday: true,
      lang: 'zh',
      date: moment()
    };
  },
  methods: {
    onChange(date) {
      this.date = date;
    }
  }
});


new Vue({
  el: '#range',
  components: {
    'daterange':daterange.DateRange
  },
  data() {
    return {
      lang: 'en',
      range: {
        startDate: moment(),
        endDate: moment().add(7, 'days')
      }
    };
  },
  methods: {
    onChange(range) {
      this.range = range;
    },
    setRange (p) {
      if (typeof p === 'number') {
        console.log(p)
        this.range = {
          startDate: moment().add(p, 'days'),
          endDate: moment()
        }
      }
    },
  }
});

new Vue({
  el: '#custom-style',
  components: {
    'daterange':daterange.DateRange
  },
  data: {
    lang: 'en',
    range: {
      startDate: moment(),
      endDate: moment().add(7, 'days')
    }
  },
  methods: {
    onChange(range) {
      this.range = range;
    }
  }
});