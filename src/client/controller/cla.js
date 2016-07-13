// *****************************************************
// CLA Controller
//
// tmpl: cla.html
// *****************************************************

module.controller('ClaController', ['$window', '$scope', '$stateParams', '$RAW', '$RPCService', '$HUBService', '$sce', '$timeout', '$http', '$q', 'utils',
	function ($window, $scope, $stateParams, $RAW, $RPCService, $HUBService, $sce, $timeout, $http, $q, utils) {

		$scope.cla = null;
		$scope.customFields = {};
		$scope.customValues = {};
		$scope.hasCustomFields = false;
		$scope.linkedItem = null;
		$scope.noLinkedItemError = false;
		$scope.params = $stateParams;
		$scope.redirect = 'https://github.com/' + $stateParams.user + '/' + $stateParams.repo;
		$scope.user = {};
		$scope.signed = false;

		function getUserEmail(key) {
			$HUBService.call('users', 'getEmails', {}, function (err, data) {
				if (data && data.value)
				{
					data.value.some(function (email) {
						$scope.customValues[key] = email.primary ? email.email : $scope.customValues[key];
						return email.primary;
					});
				}
			});
		}

		function getGithubValues() {
			if ($scope.hasCustomFields && $scope.user.value) {
				$scope.customKeys.forEach(function (key) {
					var githubKey = $scope.customFields.properties[key].githubKey;
					if (githubKey) {
						$scope.customValues[key] = $scope.user.value[githubKey];
						if (githubKey === 'email' && !$scope.user.value.email) {
							getUserEmail(key);
						}
					}
				});
			}
		}

		function getCLA() {
			utils.getGistContent($scope.linkedItem.repoId, $scope.linkedItem.orgId).then(
				function success(gistContent) {
					$scope.cla = $sce.trustAsHtml(gistContent.claText);
					$scope.cla.text = gistContent.claText;
					$scope.claText = gistContent.claText;

					$scope.customFields = gistContent.customFields;
					$scope.customKeys = gistContent.customKeys;
					$scope.hasCustomFields = gistContent.hasCustomFields;
					getGithubValues();
				},
				function error(err) {
					$scope.noLinkedItemError = true;
				}
			);
		}

		function checkCLA() {
			return $RPCService.call('cla', 'check', {
				repo: $stateParams.repo,
				owner: $stateParams.user
			}, function (err, signed) {
				if (!err && signed.value) {
					$scope.signed = true;
				} else {
					$scope.signed = false;
				}
			});
		}

		function getLinkedItem(callback) {
			return $RPCService.call('cla', 'getLinkedItem', {
				repo: $stateParams.repo,
				owner: $stateParams.user
			}, function (err, linkedItem) {
				if(err){
					$scope.noLinkedItemError = true;
				}
				callback(linkedItem.value);
			});
		}

		var getUser = function () {
			return $HUBService.call('users', 'get', {}, function (err, res) {
				if (err) {
					return;
				}

				$scope.user = res;
				$scope.user.value.admin = false;
				if (res.meta && res.meta.scopes && res.meta.scopes.indexOf('write:repo_hook') > -1) {
					$scope.user.value.admin = true;
				}
			});
		};

		var redirect = function () {
			if ($stateParams.pullRequest) {
				$scope.redirect = $scope.redirect + '/pull/' + $stateParams.pullRequest;
			}
			$http.get('/logout?noredirect=true');
			$timeout(function () {
				$window.location.href = $scope.redirect;
			}, 5000);
		};

		$scope.agree = function () {
			if (!$scope.hasCustomFields) {
				var acceptUrl = '/accept/' + $stateParams.user + '/' + $stateParams.repo;
				acceptUrl = $stateParams.pullRequest ? acceptUrl + '?pullRequest=' + $stateParams.pullRequest : acceptUrl;
				$window.location.href = acceptUrl;
			} else if ($scope.user.value && $scope.hasCustomFields) {
				$RPCService.call('cla', 'sign', {
					repo: $stateParams.repo,
					owner: $stateParams.user,
					custom_fields: JSON.stringify($scope.customValues)
				}, function (err, signed) {
					$scope.signed = signed.value;
					if ($scope.signed) {
						redirect();
					}
				});
			}
		};

		$scope.signIn = function () {
			var acceptUrl = '/signin/' + $stateParams.user + '/' + $stateParams.repo;
			$window.location.href = $stateParams.pullRequest ? acceptUrl + '?pullRequest=' + $stateParams.pullRequest : acceptUrl;
		};

		var userPromise = getUser();

		var repoPromise = getLinkedItem(function (linkedItem) {
			$scope.linkedItem = linkedItem;
			if ($scope.linkedItem) {
				getCLA();
				// getCLA().then(function (data) {
				// 	$scope.cla = $sce.trustAsHtml(data.value.raw);
				// 	$scope.cla.text = data.value.raw;
				// });
			}
		});

		$scope.isValid = function () {
			if (!$scope.customFields.required || $scope.customFields.required.length <= 0) {
				return true;
			}

			var valid = true;
			$scope.customFields.required.some(function (key) {
				var value = $scope.customValues[key];
				var property = $scope.customFields.properties[key];
				valid = value && typeof value == property.type;
				return !valid;
			});
			return valid;
		};

		$q.all([userPromise, repoPromise]).then(function () {
			if ($scope.user && $scope.user.value && $scope.linkedItem) {

				checkCLA().then(function (signed) {
					if (signed.value) {
						redirect();
					}
				});
			}
		});
	}
])
.directive('customfield', [function() {
	return {
		templateUrl: '/templates/customField.html',
		scope: {
			description: '=',
			key: '=',
			logged: '=',
			name: '=',
			required: '=',
			title: '=',
			type: '=',
			value: '=',
		}
	};
}]);