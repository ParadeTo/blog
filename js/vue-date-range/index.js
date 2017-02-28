/**
 * Created by ayou on 2017/2/28.
 */
new Vue({
  el: '#calendar',
  components: {
    'calendar':daterange.Calendar
  },
  data: {
    lang: 'en',
    date: moment().format('YYYY-MM-DD')
  },
  methods: {
    onChange(date) {
      this.date = date.format('YYYY-MM-DD');
    }
  }
});


new Vue({
  el: '#range',
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