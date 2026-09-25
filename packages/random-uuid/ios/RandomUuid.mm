#import "RandomUuid.h"

@implementation RandomUuid

RCT_EXPORT_MODULE(RandomUuid)

+ (BOOL)requiresMainQueueSetup {
    return NO;
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(getRandomUuid) {
    return [[[NSUUID UUID] UUIDString] lowercaseString];
}

@end
