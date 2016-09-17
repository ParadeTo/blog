/**
 * Created by ayou on 2016-06-16.
 */
 ;(function(){
   $(function(){
     $("#myWords").lbyl({
          content: "亲爱的小妹纸，第一个生日，男朋友就不在身边，依我看，这个男朋友还不如休了算了。"+
            "其实，男朋友真的好想能给你过一个生日。"+
            "身在异国他乡，希望你能开开心心（男朋友尽量不惹你生气）地过每一天，好好照顾好自己。",
          speed: 300, //time between each new letter being added
          type: 'show', // 'show' or 'fade'
          fadeSpeed: 500, // Only relevant when the 'type' is set to 'fade'
          finished: function(){ console.log('finished') } // Finished Callback
      });
   });
 })()
