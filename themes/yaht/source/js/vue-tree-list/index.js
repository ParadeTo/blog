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

  new Vue({
    el: '#app',
    components: {
      'VueTreeList': VueTreeList.VueTreeList
    },
    data () {
      return {
        isMobile: isMobile(),
        record: null,
        newTree: {},
        data: new VueTreeList.Tree([
          {
            name: 'Node 1',
            id: 1,
            pid: 0,
            children: [
              {
                name: 'Node 1-2',
                id: 2,
                isLeaf: true,
                pid: 1
              }
            ]
          },
          {
            name: 'Node 2',
            id: 3,
            pid: 0
          },
          {
            name: 'Node 3',
            id: 4,
            pid: 0
          }
        ])
      }
    },
    methods: {
      addNode: function () {
        var node = new VueTreeList.TreeNode('new node', false)
        if (!this.data.children) this.data.children = []
        this.data.addChildren(node)
      },

      getNewTree: function () {
        const vm = this
        function _dfs (oldNode) {
          let newNode = {}

          newNode.name = oldNode.name
          newNode.pid = oldNode.pid
          newNode.isLeaf = oldNode.isLeaf
          newNode.id = oldNode.id

          if (oldNode.children && oldNode.children.length > 0) {
            newNode.children = []
            for (let i = 0, len = oldNode.children.length; i < len; i++) {
              newNode.children.push(_dfs(oldNode.children[i]))
            }
          }
          return newNode
        }

        vm.newTree = _dfs(vm.data)
      }
    }
  })