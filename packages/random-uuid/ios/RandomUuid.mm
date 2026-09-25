#import "RandomUuid.h"

@implementation RandomUuid

- (NSString *)getRandomUuid {
    return [[[NSUUID UUID] UUIDString] lowercaseString];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
    return std::make_shared<facebook::react::NativeRandomUuidSpecJSI>(
        params);
}

+ (NSString *)moduleName {
    return @"RandomUuid";
}

@end
