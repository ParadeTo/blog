/**
 * Created by ayou on 2016-06-16.
 */
 ;(function(){
   $(function(){
     $("#myWords").lbyl({
          content: "亲爱的小妹纸，生日快乐！只能送一个假蛋糕给你了，第一个生日，男朋友就不在身边，依我看，这个男朋友还不如休了算了。^-^"+
            "外面的世界很精彩，希望你能开开心心地去领略，好好照顾好自己。",
          speed: 300, //time between each new letter being added
          type: 'show', // 'show' or 'fade'
          fadeSpeed: 500, // Only relevant when the 'type' is set to 'fade'
          finished: function(){
            $("#sign").lbyl({
                 content: "I Love you",
                 speed: 300, //time between each new letter being added
                 type: 'show', // 'show' or 'fade'
                 fadeSpeed: 500, // Only relevant when the 'type' is set to 'fade'
               });
          } // Finished Callback
      });
   });
 })();
