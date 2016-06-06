/**
 * Created by ayou on 2016-06-06.
 */


function insertSort(a) {                    //代价          //次数
  for(var j=1;j< a.length;j++) {            // c1                 n
    var key = a[j];                              // c2                n-1
    i = j - 1;                                       // c3                n-1
    while(i >= 0 && a[i] > key) {          // c4
      a[i+1] = a [i];
      i = i-1;
    }
    a[i+1] = key;
  }
  return a;
}

var a = [5,4,3,2,1];
insertSort(a);
console.log(a);