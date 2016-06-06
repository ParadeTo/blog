/**
 * Created by ayou on 2016-06-06.
 */

function dcSort(arr) {
  divide(arr,0,arr.length-1);
}

function divide(arr,p,r) {
  if (p<r) {
    var q = parseInt((p+r) / 2);
    divide(arr, p, q); // 分治
    divide(arr, q+1, r); // 分治
    merge(arr, p, q, r); // 合并
  }
}

function merge(arr, p, q, r) {
  var n1 = q-p+1;
  var n2 = r-q;
  var L = [];
  var R = [];
  for (var i=0;i<n1;i++) {
    L[i] = arr[p+i];
  }
  for (var j=0;j<n2;j++) {
    R[j] = arr[q+1+j];
  }
  L[n1] = 9999; // 设置一个极大值
  R[n2] = 9999; // 极大值
  i=0;
  j=0;
  for (var k=p;k<=r;k++) {
    if (L[i] <= R[j]) {
      arr[k] = L[i++];
    } else {
      arr[k] = R[j++];
    }
  }
}

var a = [5,4,3,2,1];
dcSort(a);
console.log(a);